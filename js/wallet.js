// ================================================================
// WALLET.JS - Web3 / Ethers.js integráció és tBNB / Token fizetés
// ================================================================

export class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.walletAddress = null;
        // A te admin/kassza tárcád címe:
        this.adminAddress = "0xddA74737f502dFc2e2e007Ee11448E4794ADcb44";
        this.BSC_TESTNET_CHAIN_ID = "0x61"; // 97
    }

    // Tárca csatlakoztatása (MetaMask / injected provider)
    async connectWallet() {
        if (!window.ethereum) {
            throw new Error("MetaMask vagy Web3 kompatibilis tárca nem található!");
        }

        // Ethers v6 használata esetén (feltételezve, hogy window.ethers elérhető CDN-ből, vagy be van importálva)
        // Ha ethers.js-t ESM-ként vagy globális változóként használsz:
        this.provider = new ethers.BrowserProvider(window.ethereum);
        
        // Hálózat ellenőrzés / átkapcsolás BSC Testnetre
        const network = await this.provider.getNetwork();
        if (Number(network.chainId) !== 97) {
            await this.switchToBscTestnet();
        }

        await this.provider.send("eth_requestAccounts", []);
        this.signer = await this.provider.getSigner();
        this.walletAddress = await this.signer.getAddress();

        console.log(`🦊 Tárca csatlakoztatva: ${this.walletAddress}`);
        return this.walletAddress;
    }

    // Átkapcsolás BSC Testnetre, ha nem ott van a felhasználó
    async switchToBscTestnet() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.BSC_TESTNET_CHAIN_ID }],
            });
        } catch (switchError) {
            // Ha a hálózat nincs hozzáadva a MetaMaskhoz, hozzáadjuk
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: this.BSC_TESTNET_CHAIN_ID,
                            chainName: 'Binance Smart Chain Testnet',
                            nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
                            rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                            blockExplorerUrls: ['https://testnet.bscscan.com/']
                        }],
                    });
                } catch (addError) {
                    throw new Error("Nem sikerült a BSC Testnet hálózat hozzáadása a tárcához.");
                }
            } else {
                throw switchError;
            }
        }
    }

    // Díj befizetése: tBNB küldése a kassza tárcába (pl. 0.001 tBNB tesztként)
    async payEntranceFee() {
        if (!this.signer) {
            throw new Error("Nincs csatlakoztatott tárca!");
        }

        // Teszt jelleggel küldünk egy minimális tBNB-t (pl. 0.0005 tBNB vagy tetszőleges összeg)
        // Később itt majd a Gery token contract transfer() metódusát hívjuk meg!
        const feeAmount = ethers.parseEther("0.0005"); 

        const tx = await this.signer.sendTransaction({
            to: this.adminAddress,
            value: feeAmount
        });

        console.log(`⏳ Tranzakció elküldve: ${tx.hash}`);
        
        // Várjuk meg, amíg a blokklánc megerősíti a tranzakciót
        const receipt = await tx.wait();
        console.log(`✅ Tranzakció megerősítve a blokkon: ${receipt.blockNumber}`);
        
        return receipt;
    }
}