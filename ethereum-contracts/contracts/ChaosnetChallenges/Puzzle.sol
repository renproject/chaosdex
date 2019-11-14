pragma solidity ^0.5.12;


import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/libraries/Compare.sol";

contract Puzzle is Ownable {
    using SafeMath for uint256;

    bytes public secretHash;     // The hash of the secret
    uint256 public rewardAmount; // The amount of reward for solving the puzzle
    string public tokenSymbol;   // The symbol of the reward token
    bool public rewardClaimed;   // Whether the puzzle has been solved or not

    ShifterRegistry public registry;

    /// @param _registry The Shifter registry contract address
    /// @param _tokenSymbol The token symbol for the reward and the shifting
    /// @param _secretHash The secret hash
    constructor(
        ShifterRegistry _registry,
        string memory _tokenSymbol,
        bytes memory _secretHash
    ) public {
        registry = _registry;
        tokenSymbol = _tokenSymbol;
        secretHash = _secretHash;
    }

    /// @notice Funds the contract with claimable rewards
    /// @param _amount The amount of token provided to the Darknodes in Sats.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function fund(
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public {
        require(_amount > 0, "amount must be greater than 0");
        uint256 transferAmount = registry.getShifterBySymbol(tokenSymbol).shiftIn(0x0, _amount, _nHash, _sig);
        rewardAmount = rewardAmount.add(transferAmount);
    }

    /// @notice Allows someone to try and claim the reward by submitting the secret.
    /// @param _refundAddress The address that should receive the shiftedOut tokens and the potential reward.
    /// @param _secret The secret.
    /// @param _amount The amount of token provided to the Darknodes in Sats.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function claimReward(
        // Payload
        bytes memory _refundAddress,
        bytes memory _secret,
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public {
        require(_amount > 0, "amount must be greater than 0");

        // Construct the payload hash and verify the signature to ensure the Darknodes have
        // received the token.
        bytes32 pHash = hashPayload(_refundAddress, _secret);
        uint256 transferAmount = registry.getShifterBySymbol(tokenSymbol).shiftIn(pHash, _amount, _nHash, _sig);

        // If the secret is correct, give the reward
        if (validateSecret(_secret) && !rewardClaimed) {
            rewardClaimed = true;
            transferAmount = transferAmount.add(rewardAmount);
        }

        // Shift out the funds to the specified address
        registry.getShifterBySymbol(tokenSymbol).shiftOut(_refundAddress, transferAmount);
    }

    /// @notice Shifts out tokens from the contract to reduce the reward distributed.
    ///
    /// @param _address The address to shift the tokens out to
    /// @param _amount  The amount to shift out
    function shiftOut(bytes calldata _address, uint256 _amount) external onlyOwner {
        registry.getShifterBySymbol(tokenSymbol).shiftOut(_address, _amount);
        rewardAmount = rewardAmount.sub(_amount);
    }

    /// @notice Get the hash payload
    ///
    /// @param _refundAddress The address that should receive the shiftedOut tokens and the potential reward.
    /// @param _secret The secret.
    function hashPayload(
        bytes memory _refundAddress,
        bytes memory _secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_refundAddress, _secret));
    }

    /// @notice Validate that the secret is correct. Use this function to
    ///         validate your answer if you think you've got it before
    ///         submitting a swap. You could also use this to brute-force
    ///         the answer too if you want.
    ///
    /// @param _secret The secret.
    function validateSecret(bytes memory _secret) public view returns (bool) {
        bytes memory h = abi.encodePacked(sha256(_secretMessage(_secret)));
        return Compare.bytesEqual(h, secretHash);
    }

    function _secretMessage(bytes memory _secret) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Secret(", string(_secret),
            ")"
        );
    }

}
