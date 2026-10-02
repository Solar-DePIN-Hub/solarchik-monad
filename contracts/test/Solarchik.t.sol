// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SolarchikStreak} from "../src/SolarchikStreak.sol";
import {SolarchikStrategy} from "../src/SolarchikStrategy.sol";
import {SolarchikSuns} from "../src/SolarchikSuns.sol";
import {SolarchikAgent} from "../src/SolarchikAgent.sol";

contract SolarchikTest is Test {
    SolarchikStreak streak;
    SolarchikStrategy nft;
    SolarchikSuns suns;
    SolarchikAgent agent;
    address bob = address(0xBEEF);
    address sessionKey = address(0xB0B);
    address agentKey = address(0xA6E7);

    function setUp() public {
        streak = new SolarchikStreak();
        nft = new SolarchikStrategy();
        suns = new SolarchikSuns();
        agent = new SolarchikAgent(address(0));
        vm.deal(address(this), 1 ether);
        vm.deal(bob, 1 ether);
    }

    function test_streakGrowsThenResets() public {
        streak.checkIn();
        assertEq(streak.streak(address(this)), 1);
        vm.expectRevert(bytes("too soon"));
        streak.checkIn();

        vm.warp(block.timestamp + 24 hours);
        streak.checkIn();
        assertEq(streak.streak(address(this)), 2);

        vm.warp(block.timestamp + 49 hours);
        streak.checkIn();
        assertEq(streak.streak(address(this)), 1);
    }

    function test_saleLockBlocksTransfer() public {
        uint256 id = nft.mint("Dawn", 2);
        assertEq(nft.ownerOf(id), address(this));
        nft.transferFrom(address(this), bob, id);
        assertEq(nft.ownerOf(id), bob);

        vm.prank(bob);
        nft.updateStrategy(id, "Dawn Ladder", 3);
        vm.prank(bob);
        vm.expectRevert(bytes("sale locked"));
        nft.transferFrom(bob, address(this), id);
    }

    function test_sessionKeyRecordsUntilLimit() public {
        suns.authorize{value: 0.01 ether}(sessionKey, 2, uint64(block.timestamp + 1 hours));
        assertEq(sessionKey.balance, 0.01 ether);
        vm.prank(sessionKey);
        suns.recordSun();
        vm.prank(sessionKey);
        suns.recordSuns(1);
        assertEq(suns.sunsOf(address(this)), 2);
        vm.prank(sessionKey);
        vm.expectRevert(bytes("limit"));
        suns.recordSun();
        vm.warp(block.timestamp + 2 hours);
        suns.authorize(sessionKey, 1, uint64(block.timestamp + 1 hours));
        vm.prank(sessionKey);
        suns.recordSun();
        assertEq(suns.sunsOf(address(this)), 3);
    }

    function test_revokeStopsSession() public {
        suns.authorize(sessionKey, 5, uint64(block.timestamp + 1 hours));
        suns.revoke();
        vm.prank(sessionKey);
        vm.expectRevert(bytes("session"));
        suns.recordSun();
    }

    function test_agentPaperUsesFallbackAndRespectsLimits() public {
        (int256 price, uint8 decimals, bool fromChainlink) = agent.quote();
        assertEq(price, agent.FALLBACK_PRICE());
        assertEq(decimals, 8);
        assertFalse(fromChainlink);

        agent.configure{value: 0.01 ether}(agentKey, 1, 2, 3);
        assertEq(agentKey.balance, 0.01 ether);
        vm.prank(agentKey);
        agent.recordPaper(7, 1, 1);
        vm.prank(agentKey);
        agent.recordPaper(7, 2, 1);
        assertEq(agent.paperCount(), 2);
        SolarchikAgent.Paper memory paper = agent.paperAt(0);
        assertEq(paper.strategyId, 7);
        assertFalse(paper.fromChainlink);
        assertEq(paper.price, agent.FALLBACK_PRICE());

        vm.prank(agentKey);
        vm.expectRevert(SolarchikAgent.Daily.selector);
        agent.recordPaper(7, 1, 1);

        agent.pause();
        vm.prank(agentKey);
        vm.expectRevert(SolarchikAgent.Stopped.selector);
        agent.recordPaper(7, 1, 1);

        agent.revoke();
        assertEq(agent.agent(), address(0));
    }
}
