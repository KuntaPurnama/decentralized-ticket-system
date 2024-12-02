// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

//Describe the error code
error Ticket_SoldOut();
error Ticket_AddressIsUsed(address sender);
error Ticket_UserIdCardIsUsed(address sender);
error Ticket_InsufficientBalance();
error Ticket_NotForSale(uint256 tokenId);
error Ticket_AlreadyEnabledForSale(uint256 tokenId);
error Ticket_DoesNotExist(uint256 tokenId);
error Ticket_IsUsed(uint256 tokenId);
error Ticket_NotTokenOwner(uint256 tokenId, address sender);
error Ticket_NoFunds();

/**
 * @title decentralized ticket system
 * @author Tano
 * @notice This contract is to implement secure and seamless decentralized ticket system
 * @dev this implements ERC721 token protocol to tokenize the ticket, use Ownable to implement only owner validation
 * and use ReetrancyGuard to prevent malicious action when sending ETH using the contract
 */
contract Ticket is ERC721URIStorage, Ownable, ReentrancyGuard {
    //state variable
    uint256 private immutable s_totalTickets;
    uint256 private s_ticketPrice;
    uint256 private s_ticketSold;
    uint256 private s_ticketVerified;
    uint256[] private s_tokenIds;

    mapping(uint256 => bool) private s_tokenIdUsed;
    mapping(bytes32 => bool) private s_userIdCardUsed;
    mapping(address => bool) private s_userAddressUsed;
    mapping(uint256 => bool) private s_tokenIsForSale;
    mapping(address => uint256) private s_addressToTokenId;

    //events
    event SuccessBuyTicket(address indexed sender);

    constructor(
        uint256 totalTikckets,
        uint256 ticketPrice,
        string memory eventName,
        string memory eventSymbol
    ) ERC721(eventName, eventSymbol) Ownable(msg.sender) {
        s_totalTickets = totalTikckets;
        s_ticketPrice = ticketPrice;
    }

    /**
     * @notice This function is called when users want to buy a ticket
     * @dev we generate an unique token with ERC721 protocol for every ticket purchased add payable nonReentrant to make sure the payment of ticket is secure
     */
    function buyTicket(
        string memory tokenURI,
        string memory userIdCard
    ) external payable nonReentrant {
        //Validate the request
        if (s_ticketSold >= s_totalTickets) {
            revert Ticket_SoldOut();
        }

        if (s_userAddressUsed[msg.sender]) {
            revert Ticket_AddressIsUsed(msg.sender);
        }

        if (msg.value < s_ticketPrice) {
            revert Ticket_InsufficientBalance();
        }

        bytes32 hashedUserId = keccak256(abi.encodePacked(userIdCard));

        if (s_userIdCardUsed[hashedUserId]) {
            revert Ticket_UserIdCardIsUsed(msg.sender);
        }

        //Mark the address and id card number used by requester
        s_userAddressUsed[msg.sender] = true;
        s_userIdCardUsed[hashedUserId] = true;

        //Make sure uniqueness of token id by hashing the combination of user id, sender address, timestamp, and number of ticket sold
        uint256 tokenId = uint256(
            keccak256(
                abi.encodePacked(
                    hashedUserId,
                    msg.sender,
                    block.timestamp,
                    s_ticketSold
                )
            )
        );

        s_tokenIsForSale[tokenId] = false;
        s_tokenIds.push(tokenId);
        s_addressToTokenId[msg.sender] = tokenId;

        //Mint the ticket
        _mint(msg.sender, tokenId);

        //Attach the Metadata
        _setTokenURI(tokenId, tokenURI);

        //Increment the ticket sold
        s_ticketSold++;

        //Emit the success event
        emit SuccessBuyTicket(msg.sender);
    }

    /**
     * @dev we prevent the NFT to be transfered from the owner. So the owner can't sell their purchased NFT (ticket)
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        // Call the internal safe transfer function
        if (!s_tokenIsForSale[tokenId]) {
            revert Ticket_NotForSale(tokenId);
        }

        s_addressToTokenId[from] = 0;
        s_addressToTokenId[to] = tokenId;

        super.transferFrom(from, to, tokenId);
    }

    /**
     * @dev create function to enable the ticket selling based on the tokenId but only the contract owner can access it
     */
    function enableSellingTicket(uint256 tokenId) external onlyOwner {
        if (s_tokenIsForSale[tokenId]) {
            revert Ticket_AlreadyEnabledForSale(tokenId);
        }
        s_tokenIsForSale[tokenId] = true;
    }

    /**
     * @dev create function to enable the ticket selling for all ticket but only the contract owner can access it
     */
    function enableSellingAllTicket() external onlyOwner {
        uint256 length = s_tokenIds.length;
        for (uint256 i = 0; i < length; i++) {
            s_tokenIsForSale[s_tokenIds[i]] = true;
        }
    }

    /**
     * @dev We need to verify the token(ticket). Verify that the sender really own the token
     */
    function verifyTicket(uint256 tokenId) external {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) {
            revert Ticket_DoesNotExist(tokenId);
        }

        if (owner != msg.sender) {
            revert Ticket_NotTokenOwner(tokenId, msg.sender);
        }

        if (s_tokenIdUsed[tokenId]) {
            revert Ticket_IsUsed(tokenId);
        }

        s_ticketVerified++;
        s_tokenIdUsed[tokenId] = true;
    }

    /**
     * @dev Withdraw the balance to contract owner
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance <= 0) {
            revert Ticket_NoFunds();
        }

        payable(owner()).transfer(balance);
    }

    /**
     * @dev Getter function
     */
    function getTotalTickets() public view returns (uint256) {
        return s_totalTickets;
    }

    function getTicketPrice() public view returns (uint256) {
        return s_ticketPrice;
    }

    function getTicketVerified() public view returns (uint256) {
        return s_ticketVerified;
    }

    function getTicketSold() public view returns (uint256) {
        return s_ticketSold;
    }

    function getAddressTokenId() public view returns (uint256) {
        return s_addressToTokenId[msg.sender];
    }

    function getTokenTransferEnabledStatus(
        uint256 tokenId
    ) public view returns (bool) {
        return s_tokenIsForSale[tokenId];
    }

    function getTokenUsedStatus(uint256 tokenId) public view returns (bool) {
        return s_tokenIdUsed[tokenId];
    }
}
