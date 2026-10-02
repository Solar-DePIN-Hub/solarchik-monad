// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SolarchikStreak} from "../src/SolarchikStreak.sol";
import {SolarchikStrategy} from "../src/SolarchikStrategy.sol";

contract SolarchikTest is Test {
    SolarchikStreak streak;
    SolarchikStrategy nft;
    address bob = address(0xBEEF);

    function setUp() public {
        streak = new SolarchikStreak();
        nft = new SolarchikStrategy();
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

        vm.warp(block.timestamp + 240 hours);
        vm.prank(bob);
        nft.transferFrom(bob, address(this), id);
        assertEq(nft.ownerOf(id), address(this));
    }

    function test_tokenUriIsOnChainJson() public {
        uint256 id = nft.mint("Paper", 1);
        string memory uri = nft.tokenURI(id);
        assertTrue(_starts(uri, "data:application/json;base64,"));
        uint256[] memory owned = nft.tokensOfOwner(address(this));
        assertEq(owned.length, 1);
        assertEq(owned[0], id);
    }

    function _starts(string memory s, string memory prefix) private pure returns (bool) {
        bytes memory a = bytes(s);
        bytes memory b = bytes(prefix);
        if (a.length < b.length) return false;
        for (uint256 i = 0; i < b.length; i++) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }
}
