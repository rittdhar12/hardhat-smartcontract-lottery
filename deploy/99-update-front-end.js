const { ethers, network } = require("hardhat");
const fs = require("fs");
const { FRONT_END_ABI_FILE, FRONT_END_ADDRESSES_FILE } = require("../helper-hardhat-config");

// const FRONT_END_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddress.json";
// const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating Front end...");
        await updateContractAddresses();
        await updateAbi();
    }
};

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle");
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.formatJson());
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf-8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.target)) {
            currentAddresses[chainId].push(raffle.target);
        }
    } else {
        currentAddresses[chainId] = [raffle.target];
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

module.exports.tags = ["all", "frontend"];
