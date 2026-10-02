// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SolarchikStreak
/// @notice One check-in per address per 24 hours. The streak grows when the
///         next check-in lands within 48 hours of the previous one; after that
///         it starts again at 1. Monad testnet. No tokens, no custody.
contract SolarchikStreak {
    uint256 public constant INTERVAL = 24 hours;
    uint256 public constant GRACE = 48 hours;

    mapping(address => uint256) public streak;
    mapping(address => uint256) public lastCheckIn;

    event CheckedIn(address indexed user, uint256 streak, uint256 timestamp);

    function checkIn() external {
        uint256 last = lastCheckIn[msg.sender];
        require(last == 0 || block.timestamp >= last + INTERVAL, "too soon");
        uint256 nextStreak = (last != 0 && block.timestamp <= last + GRACE) ? streak[msg.sender] + 1 : 1;
        streak[msg.sender] = nextStreak;
        lastCheckIn[msg.sender] = block.timestamp;
        emit CheckedIn(msg.sender, nextStreak, block.timestamp);
    }

    function canCheckIn(address user) external view returns (bool) {
        uint256 last = lastCheckIn[user];
        return last == 0 || block.timestamp >= last + INTERVAL;
    }

    function nextCheckInAt(address user) external view returns (uint256) {
        uint256 last = lastCheckIn[user];
        if (last == 0) return 0;
        return last + INTERVAL;
    }
}
