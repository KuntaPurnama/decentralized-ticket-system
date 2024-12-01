import { run } from "hardhat";

interface VerifyArgs {
  address: string;
  constructorArguments: any[];
}

async function verify(contractAddress: string, args: any[]): Promise<void> {
  console.log("Verify contract");

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    } as VerifyArgs);
  } catch (e: any) {
    if (e.message && e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified");
    } else {
      console.log(e);
    }
  }
}

export { verify };
