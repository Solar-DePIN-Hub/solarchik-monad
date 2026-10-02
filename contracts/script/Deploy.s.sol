// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SolarchikStreak} from "../src/SolarchikStreak.sol";
import {SolarchikStrategy} from "../src/SolarchikStrategy.sol";

/// @notice Broadcasts both Solarchik contracts to Monad testnet.
///         forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        SolarchikStreak streak = new SolarchikStreak();
        SolarchikStrategy strategy = new SolarchikStrategy();
        vm.stopBroadcast();
        console2.log("VITE_STREAK_ADDRESS", address(streak));
        console2.log("VITE_STRATEGY_ADDRESS", address(strategy));
    }
}
