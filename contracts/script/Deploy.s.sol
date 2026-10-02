// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SolarchikStreak} from "../src/SolarchikStreak.sol";
import {SolarchikStrategy} from "../src/SolarchikStrategy.sol";
import {SolarchikSuns} from "../src/SolarchikSuns.sol";
import {SolarchikAgent} from "../src/SolarchikAgent.sol";

/// @notice Broadcasts Solarchik contracts.
///         CHAINLINK_FEED is optional. Leave it unset on Monad testnet:
///         Chainlink price feeds are not published there.
///         forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external {
        address feed = vm.envOr("CHAINLINK_FEED", address(0));
        vm.startBroadcast();
        SolarchikStreak streak = new SolarchikStreak();
        SolarchikStrategy strategy = new SolarchikStrategy();
        SolarchikSuns suns = new SolarchikSuns();
        SolarchikAgent agent = new SolarchikAgent(feed);
        vm.stopBroadcast();
        console2.log("VITE_STREAK_ADDRESS", address(streak));
        console2.log("VITE_STRATEGY_ADDRESS", address(strategy));
        console2.log("VITE_SUNS_ADDRESS", address(suns));
        console2.log("VITE_AGENT_ADDRESS", address(agent));
        console2.log("CHAINLINK_FEED", feed);
    }
}
