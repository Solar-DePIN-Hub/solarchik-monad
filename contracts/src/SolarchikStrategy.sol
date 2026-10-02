// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "./Base64.sol";

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @title SolarchikStrategy
/// @notice ERC-721 for a named paper strategy and a risk level (1 low, 2 medium, 3 high).
///         tokenURI is on-chain JSON. Updating a strategy sets a 240 hour sale lock.
///         Transfers revert while the lock is active. This contract does not trade,
///         hold funds, or read prices. Metadata is a simulation label only.
contract SolarchikStrategy {
    function name() external pure returns (string memory) {
        return "Solarchik Strategy";
    }

    function symbol() external pure returns (string memory) {
        return "SOLSTRAT";
    }

    uint256 public constant LOCK = 240 hours;

    uint256 public nextId = 1;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balance;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    struct Strat {
        string name;
        uint8 risk;
        uint64 lockedUntil;
        uint64 mintedAt;
    }

    mapping(uint256 => Strat) private _strats;
    mapping(address => uint256[]) private _owned;
    mapping(uint256 => uint256) private _ownedIndex;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event StrategyMinted(address indexed owner, uint256 indexed tokenId, string name, uint8 risk);
    event StrategyUpdated(uint256 indexed tokenId, string name, uint8 risk, uint256 lockedUntil);

    function mint(string calldata strategyName, uint8 risk) external returns (uint256 tokenId) {
        _checkName(strategyName);
        _checkRisk(risk);
        tokenId = nextId++;
        _strats[tokenId] = Strat({
            name: strategyName,
            risk: risk,
            lockedUntil: 0,
            mintedAt: uint64(block.timestamp)
        });
        _mint(msg.sender, tokenId);
        emit StrategyMinted(msg.sender, tokenId, strategyName, risk);
    }

    /// @notice Rewrites the strategy and refreshes the 240h transfer lock.
    function updateStrategy(uint256 tokenId, string calldata strategyName, uint8 risk) external {
        require(ownerOf(tokenId) == msg.sender, "owner");
        _checkName(strategyName);
        _checkRisk(risk);
        uint64 until = uint64(block.timestamp + LOCK);
        _strats[tokenId].name = strategyName;
        _strats[tokenId].risk = risk;
        _strats[tokenId].lockedUntil = until;
        emit StrategyUpdated(tokenId, strategyName, risk, until);
    }

    function strategyOf(uint256 tokenId) external view returns (string memory, uint8, uint64, uint64) {
        require(_ownerOf[tokenId] != address(0), "missing");
        Strat memory s = _strats[tokenId];
        return (s.name, s.risk, s.lockedUntil, s.mintedAt);
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _owned[owner];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf[tokenId] != address(0), "missing");
        return _uri(tokenId);
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "zero");
        return _balance[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _ownerOf[tokenId];
        require(owner != address(0), "missing");
        return owner;
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "auth");
        getApproved[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != address(0), "zero");
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "auth");
        require(to != address(0), "zero");
        require(from != to, "self");
        require(ownerOf(tokenId) == from, "from");
        _requireUnlocked(tokenId);
        _move(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0x01ffc9a7;
    }

    function _checkName(string calldata strategyName) private pure {
        uint256 n = bytes(strategyName).length;
        require(n >= 1 && n <= 64, "name");
    }

    function _checkRisk(uint8 risk) private pure {
        require(risk >= 1 && risk <= 3, "risk");
    }

    function _requireUnlocked(uint256 tokenId) private view {
        require(block.timestamp >= _strats[tokenId].lockedUntil, "sale locked");
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) private view returns (bool) {
        address owner = ownerOf(tokenId);
        return spender == owner || getApproved[tokenId] == spender || isApprovedForAll[owner][spender];
    }

    function _mint(address to, uint256 tokenId) private {
        require(to != address(0), "zero");
        _balance[to] += 1;
        _ownerOf[tokenId] = to;
        _addToken(to, tokenId);
        emit Transfer(address(0), to, tokenId);
    }

    function _move(address from, address to, uint256 tokenId) private {
        _balance[from] -= 1;
        _balance[to] += 1;
        _ownerOf[tokenId] = to;
        delete getApproved[tokenId];
        _removeToken(from, tokenId);
        _addToken(to, tokenId);
        emit Transfer(from, to, tokenId);
    }

    function _addToken(address to, uint256 tokenId) private {
        _ownedIndex[tokenId] = _owned[to].length;
        _owned[to].push(tokenId);
    }

    function _removeToken(address from, uint256 tokenId) private {
        uint256 lastIndex = _owned[from].length - 1;
        uint256 index = _ownedIndex[tokenId];
        if (index != lastIndex) {
            uint256 lastId = _owned[from][lastIndex];
            _owned[from][index] = lastId;
            _ownedIndex[lastId] = index;
        }
        _owned[from].pop();
        delete _ownedIndex[tokenId];
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length == 0) return;
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            require(retval == IERC721Receiver.onERC721Received.selector, "receiver");
        } catch {
            revert("receiver");
        }
    }

    function _uri(uint256 tokenId) private view returns (string memory) {
        Strat memory s = _strats[tokenId];
        string memory risk = s.risk == 1 ? "Low" : s.risk == 2 ? "Medium" : "High";
        string memory letter = s.risk == 1 ? "L" : s.risk == 2 ? "M" : "H";
        string memory fill = s.risk == 1 ? "#FFB703" : s.risk == 2 ? "#FB6D1E" : "#3A2410";
        string memory ink = s.risk == 3 ? "#FFF6E8" : "#3A2410";
        string memory svg = string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>",
            "<rect width='64' height='64' rx='14' fill='#FFF6E8'/>",
            "<circle cx='32' cy='32' r='16' fill='",
            fill,
            "'/>",
            "<text x='32' y='38' text-anchor='middle' font-size='16' font-family='sans-serif' fill='",
            ink,
            "'>",
            letter,
            "</text></svg>"
        );
        string memory json = string.concat(
            '{"name":"',
            _escape(bytes(s.name)),
            '","description":"Solarchik strategy NFT on Monad testnet. PAPER SIMULATION ONLY. Not a live trading agent, not an order, and not financial advice.",',
            '"attributes":[{"trait_type":"Risk","value":"',
            risk,
            '"},{"trait_type":"Mode","value":"Paper simulation"},{"trait_type":"Sale lock hours","value":240}],',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _escape(bytes memory src) private pure returns (string memory) {
        uint256 extra = 0;
        for (uint256 i = 0; i < src.length; i++) {
            if (_needsEscape(src[i])) extra++;
        }
        if (extra == 0) return string(src);
        bytes memory out = new bytes(src.length + extra);
        uint256 j = 0;
        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (_needsEscape(c)) {
                out[j++] = hex"5c";
                if (c == hex"0a") out[j++] = hex"6e";
                else if (c == hex"0d") out[j++] = hex"72";
                else out[j++] = c;
            } else {
                out[j++] = c;
            }
        }
        return string(out);
    }

    function _needsEscape(bytes1 c) private pure returns (bool) {
        return c == hex"22" || c == hex"5c" || c == hex"0a" || c == hex"0d";
    }
}
