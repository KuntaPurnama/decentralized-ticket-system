import { ethers } from "hardhat";
import { TicketAddress } from "../contract-address";

async function createOrder() {
  console.log(
    "=========================Start buying ticket======================="
  );
  const signers = await ethers.getSigners();

  const ticketContract = await ethers.getContractAt(
    "Ticket",
    TicketAddress,
    signers[0]
  );

  const toWei = (num: Number) => ethers.parseEther(num.toString());

  try {
    //check the ticket price deploy/00-deploy-ticket.ts where the deployment config written
    const buyTicketTx = await ticketContract.buyTicket("tokenURI", "userID", {
      value: toWei(0.0001),
    });
    await buyTicketTx.wait();

    console.log(
      "========================Success buy ticket========================"
    );
  } catch (e) {
    if (e.toString().includes("reverted with an unrecognized custom error")) {
      const decodedError = ticketContract.interface.parseError(e.data.data);
      const errorMessage = decodedError?.name;

      console.log("Error when buying ticket with custom error: ", errorMessage);
    } else {
      console.log("Error when buying ticket: ", e);
    }
  }
}

createOrder()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
