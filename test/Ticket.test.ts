import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, network } from "hardhat";
import { assert, expect } from "chai";
import { developmentChains } from "../hardhat-helper-config";
import { ContractTransactionResponse } from "ethers";
import { Ticket } from "../typechain-types";

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Ticket", function () {
      const toWei = (num: Number) => ethers.parseEther(num.toString());

      async function deployTicket() {
        const Ticket = await ethers.getContractFactory("Ticket");
        const ticket = await Ticket.deploy(
          2,
          toWei(0.0001),
          "LinkinPark",
          "LP"
        );

        return ticket;
      }

      describe("Deployment", function () {
        it("Should be get the constructor parameter", async function () {
          const ticket = await loadFixture(deployTicket);
          const name = await ticket.name();
          const symbol = await ticket.symbol();
          const totalTickets = await ticket.getTotalTickets();
          const ticketPrice = await ticket.getTicketPrice();

          assert.equal(name, "LinkinPark");
          assert.equal(symbol, "LP");
          assert.equal(totalTickets.toString(), "2");
          assert.equal(ticketPrice, toWei(0.0001));
        });
      });

      describe("Buy Ticket", function () {
        let ticket: Ticket & {
          deploymentTransaction(): ContractTransactionResponse;
        };

        this.beforeAll(async function () {
          ticket = await loadFixture(deployTicket);
        });

        it("Success Buy ticket", async function () {
          const ticketSold = await ticket.getTicketSold();
          assert(ticketSold.toString(), "0");

          expect(
            await ticket.buyTicket("test", "userId", {
              value: toWei(0.0001),
            })
          ).to.emit(ticket, "SuccessBuyTicket");

          const updatedTicketSold = await ticket.getTicketSold();
          assert(updatedTicketSold.toString(), "1");

          const tokenId = await ticket.getAddressTokenId();
          console.log("user token Id: ", tokenId.toString());
        });

        it("Failed Buy Ticket By Same Address", async function () {
          await expect(
            ticket.buyTicket("test", "userId2", {
              value: toWei(0.0001),
            })
          ).to.be.revertedWith("User Account Address Has Been Used");
        });

        it("Failed Buy Ticket By Same UserId", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);
          await expect(
            secondTicket.buyTicket("test", "userId", {
              value: toWei(0.0001),
            })
          ).to.be.revertedWith("User ID Card Number Has Been Used");
        });

        it("Failed Buy Ticket With Insufficient Amount", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);
          await expect(
            secondTicket.buyTicket("test", "userId2", {
              value: toWei(0.00001),
            })
          ).to.be.revertedWith("Insufficient Balance To Buy The Ticket");
        });

        it("Failed Buy Ticket Because of Sold Out", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);

          await secondTicket.buyTicket("test", "userId2", {
            value: toWei(0.0001),
          });

          const thirdUser = signers[1];
          const thirdTicket = ticket.connect(thirdUser);

          await expect(
            thirdTicket.buyTicket("test", "userId2", {
              value: toWei(0.00001),
            })
          ).to.be.revertedWith("Sold Out");
        });
      });
    });
