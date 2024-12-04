import { ethers } from "hardhat";
import { TicketAddress } from "../contract-address";

async function createOrder() {
  console.log(
    "=========================Start getting ticket======================="
  );
  const signers = await ethers.getSigners();

  const ticketContract = await ethers.getContractAt(
    "Ticket",
    TicketAddress,
    signers[0]
  );

  try {
    //Check the ticket used status before verify
    //Get tokenId and pass it when get used status;
    const tokenId = await ticketContract.getAddressTokenId();
    const isTicketUsedBefore = await ticketContract.getTokenUsedStatus(
      tokenId.toString()
    );

    console.log("token id: ", tokenId.toString());
    console.log("ticket used: ", isTicketUsedBefore);

    console.log(
      "========================Success get ticket========================"
    );
  } catch (e) {
    if (e.toString().includes("reverted with an unrecognized custom error")) {
      const decodedError = ticketContract.interface.parseError(e.data.data);
      const errorMessage = decodedError?.name;

      console.log(
        "Error when verifying ticket with custom error: ",
        errorMessage
      );
    } else {
      console.log("Error when get ticket: ", e);
    }
  }
}

createOrder()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
