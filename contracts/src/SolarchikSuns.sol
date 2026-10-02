// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SolarchikSuns
/// @notice Records rooftop suns on-chain. The player authorizes one session key
///         with a spend limit and an expiry, then that key calls recordSun
///         without another wallet confirmation. The session key is funded in
///         authorize() so it can pay gas. This contract does not mint a token.
contract SolarchikSuns {
    struct Session {
        address key;
        uint64 expiry;
        uint32 spent;
        uint32 limit;
        bool revoked;
    }

    mapping(address => Session) public sessionOf;
    mapping(address => uint256) public sunsOf;
    mapping(address => address) public playerOfKey;

    event SessionAuthorized(
        address indexed player,
        address indexed sessionKey,
        uint32 spendLimit,
        uint64 expiry,
        uint256 funded
    );
    event SessionRevoked(address indexed player, address indexed sessionKey);
    event SunRecorded(address indexed player, address indexed sessionKey, uint256 total, uint32 count);

    function authorize(address sessionKey, uint32 spendLimit, uint64 expiry) external payable {
        require(sessionKey != address(0) && sessionKey != msg.sender, "key");
        require(expiry > block.timestamp && expiry <= block.timestamp + 7 days, "expiry");
        require(spendLimit > 0 && spendLimit <= 200, "limit");
        Session memory prev = sessionOf[msg.sender];
        if (prev.key != address(0) && playerOfKey[prev.key] == msg.sender) {
            playerOfKey[prev.key] = address(0);
        }
        require(playerOfKey[sessionKey] == address(0) || playerOfKey[sessionKey] == msg.sender, "used");
        sessionOf[msg.sender] = Session({
            key: sessionKey,
            expiry: expiry,
            spent: 0,
            limit: spendLimit,
            revoked: false
        });
        playerOfKey[sessionKey] = msg.sender;
        if (msg.value > 0) {
            (bool ok,) = sessionKey.call{value: msg.value}("");
            require(ok, "fund");
        }
        emit SessionAuthorized(msg.sender, sessionKey, spendLimit, expiry, msg.value);
    }

    function revoke() external {
        Session memory prev = sessionOf[msg.sender];
        require(prev.key != address(0), "session");
        if (playerOfKey[prev.key] == msg.sender) playerOfKey[prev.key] = address(0);
        sessionOf[msg.sender].revoked = true;
        sessionOf[msg.sender].key = address(0);
        emit SessionRevoked(msg.sender, prev.key);
    }

    function recordSun() external {
        _record(1);
    }

    function recordSuns(uint32 count) external {
        _record(count);
    }

    function _record(uint32 count) internal {
        address player = playerOfKey[msg.sender];
        Session storage s = sessionOf[player];
        require(player != address(0) && s.key == msg.sender && !s.revoked, "session");
        require(block.timestamp <= s.expiry, "expired");
        require(count > 0 && count <= 8, "batch");
        require(uint256(s.spent) + count <= s.limit, "limit");
        s.spent += count;
        sunsOf[player] += count;
        emit SunRecorded(player, msg.sender, sunsOf[player], count);
    }
}
