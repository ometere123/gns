// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title GNSPaymentRouter
/// @notice Arc USDC payment rail for GNS registrations and renewals.
/// @dev Namespace ownership and authenticity stay on GenLayer. This router only
///      collects USDC and emits receipts that GenLayer independently verifies.
contract GNSPaymentRouter {
    uint8 public constant ACTION_REGISTER = 1;
    uint8 public constant ACTION_RENEW = 2;
    uint256 public constant USDC_SCALE = 1e6;
    uint256 public constant MAX_PRICE_PER_YEAR = 1_000 * USDC_SCALE;
    string public constant VERSION = "1.0.0-arc-usdc";

    IERC20Minimal public immutable usdc;

    address public admin;
    address public pendingAdmin;
    address public treasury;
    address public pendingTreasury;

    uint256 public registrationPricePerYear;
    uint256 public renewalPricePerYear;
    uint256 public totalCollected;
    uint256 public totalWithdrawn;
    uint256 public paymentCount;
    bool public paused;

    uint256 private _entered;

    event PaymentRecorded(
        address indexed payer,
        bytes32 indexed namespaceHash,
        uint8 indexed action,
        uint16 durationYears,
        uint256 amount
    );
    event PricesUpdated(uint256 registrationPricePerYear, uint256 renewalPricePerYear);
    event PauseUpdated(bool paused);
    event AdminTransferProposed(address indexed currentAdmin, address indexed pendingAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event TreasuryTransferProposed(address indexed currentTreasury, address indexed pendingTreasury);
    event TreasuryTransferred(address indexed previousTreasury, address indexed newTreasury);
    event TreasuryWithdrawal(address indexed treasury, uint256 amount);

    error Unauthorized();
    error InvalidAddress();
    error InvalidNamespace();
    error InvalidYears();
    error InvalidPrice();
    error Paused();
    error TransferFailed();
    error InvalidAmount();
    error Reentrancy();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 1) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(
        address usdc_,
        address admin_,
        address treasury_,
        uint256 registrationPricePerYear_,
        uint256 renewalPricePerYear_
    ) {
        if (usdc_ == address(0) || admin_ == address(0) || treasury_ == address(0)) {
            revert InvalidAddress();
        }
        _validatePrice(registrationPricePerYear_);
        _validatePrice(renewalPricePerYear_);

        usdc = IERC20Minimal(usdc_);
        admin = admin_;
        treasury = treasury_;
        registrationPricePerYear = registrationPricePerYear_;
        renewalPricePerYear = renewalPricePerYear_;
    }

    function quoteRegistration(uint16 durationYears) external view returns (uint256) {
        _validateYears(durationYears);
        return registrationPricePerYear * uint256(durationYears);
    }

    function quoteRenewal(uint16 durationYears) external view returns (uint256) {
        _validateYears(durationYears);
        return renewalPricePerYear * uint256(durationYears);
    }

    function payRegistration(string calldata normalizedNamespace, uint16 durationYears)
        external
        nonReentrant
        returns (uint256 amount)
    {
        return _pay(
            normalizedNamespace,
            durationYears,
            ACTION_REGISTER,
            registrationPricePerYear
        );
    }

    function payRenewal(string calldata normalizedNamespace, uint16 durationYears)
        external
        nonReentrant
        returns (uint256 amount)
    {
        return _pay(normalizedNamespace, durationYears, ACTION_RENEW, renewalPricePerYear);
    }

    function setPrices(uint256 registrationPricePerYear_, uint256 renewalPricePerYear_)
        external
        onlyAdmin
    {
        _validatePrice(registrationPricePerYear_);
        _validatePrice(renewalPricePerYear_);
        registrationPricePerYear = registrationPricePerYear_;
        renewalPricePerYear = renewalPricePerYear_;
        emit PricesUpdated(registrationPricePerYear_, renewalPricePerYear_);
    }

    function setPaused(bool paused_) external onlyAdmin {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    function proposeAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0) || newAdmin == admin) revert InvalidAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(admin, newAdmin);
    }

    function cancelAdminTransfer() external onlyAdmin {
        pendingAdmin = address(0);
        emit AdminTransferProposed(admin, address(0));
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Unauthorized();
        address previous = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(previous, msg.sender);
    }

    function proposeTreasury(address newTreasury) external onlyAdmin {
        if (newTreasury == address(0) || newTreasury == treasury) revert InvalidAddress();
        pendingTreasury = newTreasury;
        emit TreasuryTransferProposed(treasury, newTreasury);
    }

    function cancelTreasuryTransfer() external onlyAdmin {
        pendingTreasury = address(0);
        emit TreasuryTransferProposed(treasury, address(0));
    }

    function acceptTreasury() external {
        if (msg.sender != pendingTreasury) revert Unauthorized();
        address previous = treasury;
        treasury = msg.sender;
        pendingTreasury = address(0);
        emit TreasuryTransferred(previous, msg.sender);
    }

    function withdraw(uint256 amount) external onlyTreasury nonReentrant {
        if (amount == 0 || amount > usdc.balanceOf(address(this))) revert InvalidAmount();
        _safeTransfer(address(usdc), treasury, amount);
        totalWithdrawn += amount;
        emit TreasuryWithdrawal(treasury, amount);
    }

    function withdrawAll() external onlyTreasury nonReentrant returns (uint256 amount) {
        amount = usdc.balanceOf(address(this));
        if (amount == 0) revert InvalidAmount();
        _safeTransfer(address(usdc), treasury, amount);
        totalWithdrawn += amount;
        emit TreasuryWithdrawal(treasury, amount);
    }

    function treasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function namespaceHash(string calldata normalizedNamespace) external pure returns (bytes32) {
        _validateNamespace(normalizedNamespace);
        return sha256(bytes(normalizedNamespace));
    }

    function _pay(
        string calldata normalizedNamespace,
        uint16 durationYears,
        uint8 action,
        uint256 pricePerYear
    ) private returns (uint256 amount) {
        if (paused) revert Paused();
        _validateNamespace(normalizedNamespace);
        _validateYears(durationYears);

        amount = pricePerYear * uint256(durationYears);
        _safeTransferFrom(address(usdc), msg.sender, address(this), amount);

        totalCollected += amount;
        paymentCount += 1;

        emit PaymentRecorded(
            msg.sender,
            sha256(bytes(normalizedNamespace)),
            action,
            durationYears,
            amount
        );
    }

    function _validateYears(uint16 durationYears) private pure {
        if (durationYears < 1 || durationYears > 5) revert InvalidYears();
    }

    function _validatePrice(uint256 price) private pure {
        if (price == 0 || price > MAX_PRICE_PER_YEAR) revert InvalidPrice();
    }

    function _validateNamespace(string calldata name) private pure {
        bytes calldata b = bytes(name);
        if (b.length < 7 || b.length > 36) revert InvalidNamespace();
        uint256 suffix = b.length - 4;
        if (
            b[suffix] != "." || b[suffix + 1] != "g" || b[suffix + 2] != "e"
                || b[suffix + 3] != "n"
        ) revert InvalidNamespace();
        if (suffix < 3 || suffix > 32) revert InvalidNamespace();

        for (uint256 i = 0; i < suffix; i++) {
            bytes1 c = b[i];
            bool letter = c >= 0x61 && c <= 0x7a;
            bool digit = c >= 0x30 && c <= 0x39;
            bool hyphen = c == 0x2d;
            if (!(letter || digit || hyphen)) revert InvalidNamespace();
            if (hyphen && (i == 0 || i + 1 == suffix)) revert InvalidNamespace();
        }
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount)
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
