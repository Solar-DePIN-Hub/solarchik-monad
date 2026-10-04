// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentDesk
/// @notice Owner limits for one agent wallet. Not deployed. Do not invent an address.
///         recordDecision does not trade. The CVI gate must pass in the same transaction.
interface ICleanverseGate {
    function passes(address user) external view returns (bool);
}

contract AgentDesk {
    address public owner;
    address public agent;
    address public gate;
    uint256 public maxPerAction;
    uint256 public dailyCap;
    uint256 public spentToday;
    uint64 public dayStart;
    uint64 public expiry;
    bool public paused;

    event LimitsSet(address indexed owner, address indexed agent, uint256 maxPerAction, uint256 dailyCap, uint64 expiry);
    event Paused(address indexed owner, bool paused);
    event DecisionRecorded(address indexed agent, uint256 indexed tokenId, bytes32 summaryHash, string model);
    event TransferGated(address indexed from, address indexed to, uint256 amount, bool allowed);

    error NotOwner();
    error NotAgent();
    error PausedOrExpired();
    error OverLimit();
    error GateClosed();

    constructor(address gate_) {
        owner = msg.sender;
        gate = gate_;
    }

    function setLimits(address agent_, uint256 maxPerAction_, uint256 dailyCap_, uint64 expiry_) external {
        if (msg.sender != owner) revert NotOwner();
        agent = agent_;
        maxPerAction = maxPerAction_;
        dailyCap = dailyCap_;
        expiry = expiry_;
        emit LimitsSet(owner, agent_, maxPerAction_, dailyCap_, expiry_);
    }

    function pause(bool next) external {
        if (msg.sender != owner) revert NotOwner();
        paused = next;
        emit Paused(owner, next);
    }

    function revoke() external {
        if (msg.sender != owner) revert NotOwner();
        agent = address(0);
        paused = true;
        emit Paused(owner, true);
    }

    function recordDecision(uint256 tokenId, string calldata model, bytes32 summaryHash) external {
        if (msg.sender != agent) revert NotAgent();
        if (paused || block.timestamp > expiry) revert PausedOrExpired();
        if (!ICleanverseGate(gate).passes(owner)) revert GateClosed();
        _spend(1);
        emit DecisionRecorded(msg.sender, tokenId, summaryHash, model);
    }

    function gatedTransfer(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        bool allowed = ICleanverseGate(gate).passes(owner);
        emit TransferGated(msg.sender, to, amount, allowed);
        if (!allowed) revert GateClosed();
    }

    function _spend(uint256 amount) private {
        if (amount > maxPerAction) revert OverLimit();
        uint64 today = uint64(block.timestamp / 1 days);
        if (today != dayStart) {
            dayStart = today;
            spentToday = 0;
        }
        if (spentToday + amount > dailyCap) revert OverLimit();
        spentToday += amount;
    }
}
