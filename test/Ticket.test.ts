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
      const toEth = (num: string) => ethers.formatEther(num);

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
          const signer = await ethers.getSigners();
          const sender = signer[0];
          
          assert(ticketSold.toString(), "0");

          expect(
            await ticket.buyTicket("test", "userId", {
              value: toWei(0.0001),
            })
          ).to.emit(ticket, "SuccessBuyTicket").withArgs(sender.address);

          const updatedTicketSold = await ticket.getTicketSold();
          assert(updatedTicketSold.toString(), "1");

          const tokenId = await ticket.getAddressTokenId();
          console.log("user token Id: ", tokenId.toString());
          const address = await ticket.getAddress();
          const balance = await ethers.provider.getBalance(address);

          assert.equal("0.0001", toEth(balance.toString()));
        });

        it("Failed Buy Ticket By Same Address", async function () {
          const signers = await ethers.getSigners();
          const firstUser = signers[0];
          await expect(
            ticket.buyTicket("test", "userId2", {
              value: toWei(0.0001),
            })
          ).to.be.revertedWithCustomError(ticket, "Ticket_AddressIsUsed").withArgs(firstUser.address);
        }); 

        it("Failed Buy Ticket By Same UserId", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);
          await expect(
            secondTicket.buyTicket("test", "userId", {
              value: toWei(0.0001),
            })
          ).to.be.revertedWithCustomError(ticket, "Ticket_UserIdCardIsUsed").withArgs(secondUser.address);
        });

        it("Failed Buy Ticket With Insufficient Amount", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);
          await expect(
            secondTicket.buyTicket("test", "userId2", {
              value: toWei(0.00001),
            })
          ).to.be.revertedWithCustomError(ticket, "Ticket_InsufficientBalance");
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
          ).to.be.revertedWithCustomError(ticket, "Ticket_SoldOut");
        });
      });

      describe("Transfer Token", function () {
        it("Token Is Not For Sale", async function () {
          const ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });
          
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const firstUser = signers[0];

          const tokenId = await ticket.getAddressTokenId();
          await expect(ticket.safeTransferFrom(firstUser.address, secondUser.address, tokenId))
          .to.be.revertedWithCustomError(ticket, "Ticket_NotForSale").withArgs(firstUser.address);
        });

        it("Failed Enable Token Transfer, Not Owner", async function () {
          const ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });

          const firstUserTokenId = await ticket.getAddressTokenId();
          
          //Use non deployer address to changet the sale status
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = await ticket.connect(secondUser);

          //use non deployer to enable selling ticket by token id
          await expect(secondTicket.enableSellingTicket(firstUserTokenId))
          .to.be.reverted;
          //use non deployer to enable selling ticket all at once
          await expect(secondTicket.enableSellingAllTicket())
          .to.be.reverted;

          const isTicketForSale = await secondTicket.getTokenTransferEnabledStatus(firstUserTokenId);
          assert.equal(isTicketForSale, false);
        });

        it("Failed Enable Token Transfer, Already Enabled", async function () {
          const ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });

          const tokenId = await ticket.getAddressTokenId();
          await ticket.enableSellingTicket(tokenId);

          //enable it again with error expected
          await expect(ticket.enableSellingTicket(tokenId)).to.be.revertedWithCustomError(ticket, "Ticket_AlreadyEnabledForSale");
        });

        it("Success Enable Token Transfer", async function () {
          const ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });
          
          //Enable token sale using its token Id
          const firstUserTokenId = await ticket.getAddressTokenId();
          let isTokenForSale: boolean = await ticket.getTokenTransferEnabledStatus(firstUserTokenId);
          assert.equal(isTokenForSale, false);
          
          await ticket.enableSellingTicket(firstUserTokenId);
          isTokenForSale = await ticket.getTokenTransferEnabledStatus(firstUserTokenId);
          assert.equal(isTokenForSale, true);
          
          //Enable token for sale all at once
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = await ticket.connect(secondUser);

          await secondTicket.buyTicket("test2", "userId2", {
            value: toWei(0.0001),
          });
          const secondUserTokenId = await secondTicket.getAddressTokenId();
          await ticket.enableSellingAllTicket();

          const isSecondTokenForSale = await secondTicket.getTokenTransferEnabledStatus(secondUserTokenId);
          assert.equal(isTokenForSale, true);
          assert.equal(isSecondTokenForSale, true);
        });

        it("Transfer Token Success", async function () {
          const ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });
          
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const firstUser = signers[0];

          const tokenId = await ticket.getAddressTokenId();

          await ticket.enableSellingTicket(tokenId);
          await ticket.safeTransferFrom(firstUser.address, secondUser.address, tokenId);
          
          const firstUserUserTokenId = await ticket.getAddressTokenId();
          const secondTicket = await ticket.connect(secondUser);
          const secondUserTokenId = await secondTicket.getAddressTokenId();
          
          assert.equal(firstUserUserTokenId.toString(), "0");
          assert.equal(secondUserTokenId.toString(), tokenId.toString());
        });
      });

      describe("Verify Ticket", function () {
        let ticket: Ticket & {
          deploymentTransaction(): ContractTransactionResponse;
        };

        this.beforeAll(async function () {
          ticket = await loadFixture(deployTicket);
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });
        });

        it("Failed To Verify, Ticket Doesn't Exists", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = await ticket.connect(secondUser);

          await expect(secondTicket.verifyTicket()).to
          .be.revertedWithCustomError(ticket, "Ticket_DoesNotExist").withArgs(secondUser.address);
        });

        // it("Failed To Verify, Not Owner", async function () {
        //   const signers = await ethers.getSigners();
        //   const secondUser = signers[1];
        //   const secondTicket = await ticket.connect(secondUser);

        //   const tokenId = await ticket.getAddressTokenId();
          
        //   await expect(secondTicket.verifyTicket(tokenId)).to
        //   .be.revertedWithCustomError(ticket, "Ticket_NotTokenOwner").withArgs(tokenId, secondUser.address);
        // });

        it("Success To Verify Ticket", async function () {
          const tokenId = await ticket.getAddressTokenId();
          const totalTicketVerified = await ticket.getTicketVerified();
          assert.equal(totalTicketVerified.toString(), "0");
          await ticket.verifyTicket();
          
          const updatedTotalTicketVerified = await ticket.getTicketVerified();
          assert.equal(updatedTotalTicketVerified.toString(), "1");

          const isTicketUsed = await ticket.getTokenUsedStatus(tokenId);
          assert.equal(isTicketUsed, true);
        });

        it("Failed To Verify, Used Ticket", async function () {
          const tokenId = await ticket.getAddressTokenId();
          const signers = await ethers.getSigners();
          const firstUser = signers[0];
          await expect(ticket.verifyTicket()).to.be.revertedWithCustomError(ticket, "Ticket_IsUsed").withArgs(firstUser.address);
        });
      });

      describe("Withdraw", function () {
        let ticket: Ticket & {
          deploymentTransaction(): ContractTransactionResponse;
        };

        this.beforeAll(async function () {
          ticket = await loadFixture(deployTicket);
        });

        it("Failed Withdraw, No Funds", async function (){
          await expect(ticket.withdraw()).to.be.revertedWithCustomError(ticket, "Ticket_NoFunds");
        });

        it("Failed Withdraw, Not Owner", async function () {
          const signers = await ethers.getSigners();
          const secondUser = signers[1];
          const secondTicket = ticket.connect(secondUser);
          
          await expect(secondTicket.withdraw()).to.be.reverted;
        });

        it("Success Withdraw", async function () {
          await ticket.buyTicket("test", "userId", {
            value: toWei(0.0001),
          });
          
          const signers = await ethers.getSigners();
          const firstUser = signers[0];
          const address = await ticket.getAddress();
          const balance = await ethers.provider.getBalance(address);

          assert.equal("0.0001", toEth(balance.toString()));

          const userBalance = await ethers.provider.getBalance(firstUser.address);

          const tx = await ticket.withdraw();
          const receipt = await tx.wait();

          const updatedBalance = await ethers.provider.getBalance(address);
          assert.equal("0.0", toEth(updatedBalance.toString()));

          const updatedUserBalance = await ethers.provider.getBalance(firstUser.address);
          const gas = receipt!.gasPrice * receipt!.gasUsed;

          const calculatedUserBalance = userBalance + balance - gas;

          assert.equal(updatedUserBalance > userBalance, true);
          assert.equal(updatedUserBalance, calculatedUserBalance);
        });
      });
    });
