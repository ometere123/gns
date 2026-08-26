// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../evm/GNSPaymentRouter.sol";

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract Actor {
    function approve(MockUSDC token, address spender, uint256 amount) external {
        require(token.approve(spender, amount), "approve");
    }

    function payRegistration(
        GNSPaymentRouter router,
        string calldata name,
        uint16 durationYears
    ) external returns (uint256) {
        return router.payRegistration(name, durationYears);
    }

    function payRenewal(GNSPaymentRouter router, string calldata name, uint16 durationYears)
        external
        returns (uint256)
    {
        return router.payRenewal(name, durationYears);
    }

    function acceptAdmin(GNSPaymentRouter router) external {
        router.acceptAdmin();
    }

    function acceptTreasury(GNSPaymentRouter router) external {
        router.acceptTreasury();
    }

    function withdraw(GNSPaymentRouter router, uint256 amount) external {
        router.withdraw(amount);
    }

    function withdrawAll(GNSPaymentRouter router) external returns (uint256) {
        return router.withdrawAll();
    }
}

contract GNSPaymentRouterTest {
    uint256 private constant ONE_USDC = 1e6;

    MockUSDC private token;
    GNSPaymentRouter private router;
    Actor private payer;
    Actor private nextAdmin;
    Actor private nextTreasury;

    function setUp() public {
        token = new MockUSDC();
        payer = new Actor();
        nextAdmin = new Actor();
        nextTreasury = new Actor();
        router = new GNSPaymentRouter(
            address(token),
            address(this),
            address(this),
            5 * ONE_USDC,
            3 * ONE_USDC
        );

        token.mint(address(payer), 100 * ONE_USDC);
        payer.approve(token, address(router), type(uint256).max);
    }

    function testRegistrationPaymentTransfersUSDC() public {
        uint256 amount = payer.payRegistration(router, "papito.gen", 2);
        require(amount == 10 * ONE_USDC, "wrong amount");
        require(token.balanceOf(address(router)) == 10 * ONE_USDC, "router balance");
        require(router.totalCollected() == 10 * ONE_USDC, "collected");
        require(router.paymentCount() == 1, "count");
    }

    function testRenewalUsesIndependentPrice() public {
        uint256 amount = payer.payRenewal(router, "papito.gen", 2);
        require(amount == 6 * ONE_USDC, "wrong renewal");
        require(router.totalCollected() == 6 * ONE_USDC, "collected");
    }

    function testPauseBlocksPayments() public {
        router.setPaused(true);
        (bool ok,) = address(payer).call(
            abi.encodeWithSelector(
                Actor.payRegistration.selector,
                router,
                "papito.gen",
                uint16(1)
            )
        );
        require(!ok, "paused payment succeeded");
    }

    function testInvalidNamespaceRejected() public {
        (bool ok,) = address(payer).call(
            abi.encodeWithSelector(
                Actor.payRegistration.selector,
                router,
                "Papito.gen",
                uint16(1)
            )
        );
        require(!ok, "invalid namespace accepted");
    }

    function testPriceUpdateIsAdminOnly() public {
        router.setPrices(7 * ONE_USDC, 4 * ONE_USDC);
        require(router.registrationPricePerYear() == 7 * ONE_USDC, "registration price");
        require(router.renewalPricePerYear() == 4 * ONE_USDC, "renewal price");

        (bool ok,) = address(payer).call(
            abi.encodeWithSelector(
                GNSPaymentRouter.setPrices.selector,
                1 * ONE_USDC,
                1 * ONE_USDC
            )
        );
        require(!ok, "non-admin changed prices");
    }

    function testTwoStepAdminTransfer() public {
        router.proposeAdmin(address(nextAdmin));
        require(router.pendingAdmin() == address(nextAdmin), "pending admin");
        nextAdmin.acceptAdmin(router);
        require(router.admin() == address(nextAdmin), "admin transfer");
        require(router.pendingAdmin() == address(0), "pending not cleared");
    }

    function testTwoStepTreasuryTransferAndWithdrawal() public {
        payer.payRegistration(router, "papito.gen", 1);
        router.proposeTreasury(address(nextTreasury));
        nextTreasury.acceptTreasury(router);
        require(router.treasury() == address(nextTreasury), "treasury transfer");

        uint256 beforeBalance = token.balanceOf(address(nextTreasury));
        nextTreasury.withdraw(router, 2 * ONE_USDC);
        require(
            token.balanceOf(address(nextTreasury)) == beforeBalance + 2 * ONE_USDC,
            "withdraw"
        );
        require(router.totalWithdrawn() == 2 * ONE_USDC, "withdraw accounting");
    }

    function testNonTreasuryCannotWithdraw() public {
        payer.payRegistration(router, "papito.gen", 1);
        (bool ok,) = address(payer).call(
            abi.encodeWithSelector(Actor.withdraw.selector, router, 1 * ONE_USDC)
        );
        require(!ok, "non-treasury withdrew");
    }

    function testWithdrawAll() public {
        payer.payRegistration(router, "papito.gen", 1);
        uint256 amount = router.withdrawAll();
        require(amount == 5 * ONE_USDC, "withdraw all amount");
        require(token.balanceOf(address(router)) == 0, "router not empty");
        require(router.totalWithdrawn() == 5 * ONE_USDC, "withdraw accounting");
    }

    function testQuoteRejectsInvalidYears() public {
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(GNSPaymentRouter.quoteRegistration.selector, uint16(0))
        );
        require(!ok, "zero years accepted");
    }
}
