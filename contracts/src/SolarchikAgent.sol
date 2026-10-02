// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title SolarchikAgent
/// @notice A simple owned agent account. The owner sets an agent key and limits.
///         The agent key may only record paper trade intents and results.
///         Nothing here swaps, holds a vault, or moves the owner's funds.
///         If no Chainlink feed is set, or the feed call fails, quote() returns
///         a labelled fallback and fromChainlink is false.
contract SolarchikAgent {
    uint8 public constant ACTION_INTENT = 1;
    uint8 public constant ACTION_RESULT = 2;
    int256 public constant FALLBACK_PRICE = 2_500_00000000;
    uint8 public constant FALLBACK_DECIMALS = 8;

    address public owner;
    address public agent;
    address public feed;
    bool public paused;
    uint256 public maxPerTrade = 1;
    uint256 public dailyCap = 20;
    uint256 public spentToday;
    uint64 public dayStart;
    uint8 public allowed = 3;

    struct Paper {
        uint256 strategyId;
        uint8 action;
        int256 price;
        uint8 decimals;
        bool fromChainlink;
        uint256 size;
        uint64 at;
    }

    Paper[] private _papers;

    event Configured(address indexed agentKey, uint256 maxPerTrade, uint256 dailyCap, uint8 allowed, uint256 funded);
    event Paused(bool paused);
    event AgentRevoked(address indexed agentKey);
    event PaperRecorded(
        address indexed agentKey,
        uint256 indexed strategyId,
        uint8 action,
        int256 price,
        uint8 decimals,
        bool fromChainlink,
        uint256 size
    );

    error NotOwner();
    error NotAgent();
    error Stopped();
    error Action();
    error Limit();
    error Daily();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address feed_) {
        owner = msg.sender;
        feed = feed_;
        dayStart = uint64(block.timestamp);
    }

    function configure(address agentKey, uint256 maxPer, uint256 daily, uint8 allowedMask) external payable onlyOwner {
        require(agentKey != address(0) && agentKey != owner, "key");
        require(maxPer > 0 && daily >= maxPer && allowedMask > 0 && allowedMask <= 3, "limits");
        agent = agentKey;
        maxPerTrade = maxPer;
        dailyCap = daily;
        allowed = allowedMask;
        paused = false;
        if (msg.value > 0) {
            (bool ok,) = agentKey.call{value: msg.value}("");
            require(ok, "fund");
        }
        emit Configured(agentKey, maxPer, daily, allowedMask, msg.value);
    }

    function setFeed(address feed_) external onlyOwner {
        feed = feed_;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }

    function unpause() external onlyOwner {
        require(agent != address(0), "agent");
        paused = false;
        emit Paused(false);
    }

    function revoke() external onlyOwner {
        address prev = agent;
        agent = address(0);
        paused = true;
        emit AgentRevoked(prev);
    }

    function quote() public view returns (int256 price, uint8 decimals, bool fromChainlink) {
        if (feed != address(0)) {
            try AggregatorV3Interface(feed).latestRoundData() returns (
                uint80, int256 answer, uint256, uint256 updatedAt, uint80
            ) {
                if (answer > 0 && updatedAt != 0) {
                    return (answer, AggregatorV3Interface(feed).decimals(), true);
                }
            } catch {}
        }
        return (FALLBACK_PRICE, FALLBACK_DECIMALS, false);
    }

    /// @notice Paper only. The price is whatever quote() returns at this block.
    function recordPaper(uint256 strategyId, uint8 action, uint256 size) external {
        if (msg.sender != agent) revert NotAgent();
        if (paused || agent == address(0)) revert Stopped();
        if (action != ACTION_INTENT && action != ACTION_RESULT) revert Action();
        if ((allowed & action) != action) revert Action();
        if (size == 0 || size > maxPerTrade) revert Limit();
        _rollDay();
        if (spentToday + size > dailyCap) revert Daily();
        spentToday += size;
        (int256 price, uint8 decimals, bool fromChainlink) = quote();
        _papers.push(
            Paper({
                strategyId: strategyId,
                action: action,
                price: price,
                decimals: decimals,
                fromChainlink: fromChainlink,
                size: size,
                at: uint64(block.timestamp)
            })
        );
        emit PaperRecorded(msg.sender, strategyId, action, price, decimals, fromChainlink, size);
    }

    function paperCount() external view returns (uint256) {
        return _papers.length;
    }

    function paperAt(uint256 index) external view returns (Paper memory) {
        return _papers[index];
    }

    function _rollDay() internal {
        if (block.timestamp >= uint256(dayStart) + 1 days) {
            dayStart = uint64(block.timestamp);
            spentToday = 0;
        }
    }
}
