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

contract FalseUSDC {
    function balanceOf(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract NoReturnUSDC {
    function balanceOf(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    fallback() external { }
}

contract ReentrantUSDC {
    GNSPaymentRouter private router;
    bool public reentryBlocked;

    function setRouter(GNSPaymentRouter router_) external {
        router = router_;
    }

    function balanceOf(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function transferFrom(address, address, uint256) external returns (bool) {
        try router.payRegistration("reentrant.gen", 1) {
            reentryBlocked = false;
        } catch {
            reentryBlocked = true;
        }
        return true;
    }
}

contract Actor {
    function approve(MockUSDC token, address spender, uint256 amount) external {
        require(token.approve(spender, amount), "approve");
    }

    function payRegistration(GNSPaymentRouter router, string calldata name, uint16 durationYears)
        external
        returns (uint256)
    {
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
            address(token), address(this), address(this), 5 * ONE_USDC, 3 * ONE_USDC
        );

        token.mint(address(payer), 100 * ONE_USDC);
        payer.approve(token, address(router), type(uint256).max);
    }

    function testConstructorRejectsInvalidConfiguration() public {
        bool ok;
        try new GNSPaymentRouter(address(0), address(this), address(this), 1, 1) {
            ok = true;
        } catch { }
        require(!ok, "zero USDC accepted");

        try new GNSPaymentRouter(address(token), address(0), address(this), 1, 1) {
            ok = true;
        } catch { }
        require(!ok, "zero admin accepted");

        try new GNSPaymentRouter(address(token), address(this), address(0), 1, 1) {
            ok = true;
        } catch { }
        require(!ok, "zero treasury accepted");

        try new GNSPaymentRouter(address(token), address(this), address(this), 0, 1) {
            ok = true;
        } catch { }
        require(!ok, "zero registration price accepted");

        try new GNSPaymentRouter(address(token), address(this), address(this), 1, 1_000_000_001) {
            ok = true;
        } catch { }
        require(!ok, "excessive renewal price accepted");
    }

    function testRegistrationPaymentTransfersUSDC() public {
        uint256 amount = payer.payRegistration(router, "papito.gen", 2);
        require(amount == 10 * ONE_USDC, "wrong amount");
        require(token.balanceOf(address(router)) == 10 * ONE_USDC, "router balance");
        require(router.totalCollected() == 10 * ONE_USDC, "collected");
        require(router.paymentCount() == 1, "count");
    }

    function testPaymentEventHashAndExactAmount() public {
        payer.payRegistration(router, "papito.gen", 1);
        require(
            router.namespaceHash("papito.gen") == sha256(bytes("papito.gen")),
            "wrong namespace hash"
        );
        require(router.totalCollected() == 5 * ONE_USDC, "wrong exact amount");
        require(router.paymentCount() == 1, "wrong payment count");
    }

    function testRenewalUsesIndependentPrice() public {
        uint256 amount = payer.payRenewal(router, "papito.gen", 2);
        require(amount == 6 * ONE_USDC, "wrong renewal");
        require(router.totalCollected() == 6 * ONE_USDC, "collected");
    }

    function testPauseBlocksPayments() public {
        router.setPaused(true);
        (bool ok,) = address(payer)
            .call(
                abi.encodeWithSelector(
                    Actor.payRegistration.selector, router, "papito.gen", uint16(1)
                )
            );
        require(!ok, "paused payment succeeded");
    }

    function testInvalidNamespaceRejected() public {
        (bool ok,) = address(payer)
            .call(
                abi.encodeWithSelector(
                    Actor.payRegistration.selector, router, "Papito.gen", uint16(1)
                )
            );
        require(!ok, "invalid namespace accepted");
    }

    function testPriceUpdateIsAdminOnly() public {
        router.setPrices(7 * ONE_USDC, 4 * ONE_USDC);
        require(router.registrationPricePerYear() == 7 * ONE_USDC, "registration price");
        require(router.renewalPricePerYear() == 4 * ONE_USDC, "renewal price");

        (bool ok,) = address(payer)
            .call(
                abi.encodeWithSelector(
                    GNSPaymentRouter.setPrices.selector, 1 * ONE_USDC, 1 * ONE_USDC
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
        require(token.balanceOf(address(nextTreasury)) == beforeBalance + 2 * ONE_USDC, "withdraw");
        require(router.totalWithdrawn() == 2 * ONE_USDC, "withdraw accounting");
    }

    function testNonTreasuryCannotWithdraw() public {
        payer.payRegistration(router, "papito.gen", 1);
        (bool ok,) = address(payer)
            .call(abi.encodeWithSelector(Actor.withdraw.selector, router, 1 * ONE_USDC));
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
        (bool ok,) = address(router)
            .call(abi.encodeWithSelector(GNSPaymentRouter.quoteRegistration.selector, uint16(0)));
        require(!ok, "zero years accepted");
        (ok,) = address(router)
            .call(abi.encodeWithSelector(GNSPaymentRouter.quoteRenewal.selector, uint16(6)));
        require(!ok, "six years accepted");
    }

    function testInvalidPricesRejected() public {
        (bool ok,) = address(router)
            .call(abi.encodeWithSelector(GNSPaymentRouter.setPrices.selector, 0, 1 * ONE_USDC));
        require(!ok, "zero registration price accepted");
        (ok,) = address(router)
            .call(
                abi.encodeWithSelector(
                    GNSPaymentRouter.setPrices.selector, 1 * ONE_USDC, 1_000 * ONE_USDC + 1
                )
            );
        require(!ok, "excessive renewal price accepted");
    }

    function testInvalidPaymentYearsRejected() public {
        (bool ok,) = address(payer)
            .call(
                abi.encodeWithSelector(
                    Actor.payRegistration.selector, router, "papito.gen", uint16(0)
                )
            );
        require(!ok, "zero payment years accepted");
        (ok,) = address(payer)
            .call(
                abi.encodeWithSelector(Actor.payRenewal.selector, router, "papito.gen", uint16(6))
            );
        require(!ok, "six payment years accepted");
    }

    function testFalseReturningTokenFailsClosed() public {
        FalseUSDC falseToken = new FalseUSDC();
        GNSPaymentRouter falseRouter = new GNSPaymentRouter(
            address(falseToken), address(this), address(this), 5 * ONE_USDC, 3 * ONE_USDC
        );
        (bool ok,) = address(falseRouter)
            .call(
                abi.encodeWithSelector(
                    falseRouter.payRegistration.selector, "papito.gen", uint16(1)
                )
            );
        require(!ok, "false token transfer accepted");
    }

    function testNoReturnTokenIsAccepted() public {
        NoReturnUSDC noReturnToken = new NoReturnUSDC();
        GNSPaymentRouter noReturnRouter = new GNSPaymentRouter(
            address(noReturnToken), address(this), address(this), 5 * ONE_USDC, 3 * ONE_USDC
        );
        (bool ok,) = address(noReturnRouter)
            .call(
                abi.encodeWithSelector(
                    noReturnRouter.payRegistration.selector, "papito.gen", uint16(1)
                )
            );
        require(ok, "no-return token transfer rejected");
        require(noReturnRouter.paymentCount() == 1, "no-return payment not counted");
    }

    function testReentrancyIsBlocked() public {
        ReentrantUSDC reentrantToken = new ReentrantUSDC();
        GNSPaymentRouter reentrantRouter = new GNSPaymentRouter(
            address(reentrantToken), address(this), address(this), 5 * ONE_USDC, 3 * ONE_USDC
        );
        reentrantToken.setRouter(reentrantRouter);
        (bool ok,) = address(reentrantRouter)
            .call(
                abi.encodeWithSelector(
                    reentrantRouter.payRegistration.selector, "papito.gen", uint16(1)
                )
            );
        require(ok, "outer payment failed");
        require(reentrantToken.reentryBlocked(), "reentrant payment was not blocked");
    }
}
