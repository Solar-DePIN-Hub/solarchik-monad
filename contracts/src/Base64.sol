// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal base64 encoder (RFC 4648), no padding bugs on short inputs.
library Base64 {
    bytes internal constant TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        uint256 len = data.length;
        if (len == 0) return "";
        bytes memory result = new bytes(4 * ((len + 2) / 3));
        uint256 i = 0;
        uint256 j = 0;
        while (i + 3 <= len) {
            uint256 n = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8) | uint8(data[i + 2]);
            result[j] = TABLE[(n >> 18) & 63];
            result[j + 1] = TABLE[(n >> 12) & 63];
            result[j + 2] = TABLE[(n >> 6) & 63];
            result[j + 3] = TABLE[n & 63];
            i += 3;
            j += 4;
        }
        if (i + 1 == len) {
            uint256 n = uint256(uint8(data[i])) << 16;
            result[j] = TABLE[(n >> 18) & 63];
            result[j + 1] = TABLE[(n >> 12) & 63];
            result[j + 2] = "=";
            result[j + 3] = "=";
        } else if (i + 2 == len) {
            uint256 n = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8);
            result[j] = TABLE[(n >> 18) & 63];
            result[j + 1] = TABLE[(n >> 12) & 63];
            result[j + 2] = TABLE[(n >> 6) & 63];
            result[j + 3] = "=";
        }
        return string(result);
    }
}
