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
        const langManager = window.GeryApp?.modules?.language;
    }

    // Tárca csatlakoztatása (MetaMask / injected provider)
    async connectWallet() {
        let errorText1 = langManager ? langManager.t("wallet_not_found") : "";
        if (!window.ethereum) {
            throw new Error(errorText1);
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
                method: "wallet_switchEthereumChain",
                params: [{ chainId: this.BSC_TESTNET_CHAIN_ID }],
            });
        } catch (switchError) {
            // Ha a hálózat nincs hozzáadva a MetaMaskhoz, hozzáadjuk
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: this.BSC_TESTNET_CHAIN_ID,
                            chainName: "Binance Smart Chain Testnet",
                            nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
                            rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                            blockExplorerUrls: ["https://testnet.bscscan.com/"]
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

    // Díj befizetése: tBNB küldése a kassza tárcába a megadott összeggel
    async payEntranceFee(customAmountStr) {
        if (!this.signer) {
            throw new Error("Nincs csatlakoztatott tárca!");
        }

        const amount = parseFloat(customAmountStr);
        if (isNaN(amount) || amount < 0.005) {
            throw new Error("A minimális összeg 0.005 tBNB!");
        }

        const feeAmount = ethers.parseEther(amount.toString()); 

        try {
            const tx = await this.signer.sendTransaction({
                to: this.adminAddress,
                value: feeAmount
            });

            const receipt = await tx.wait();
            return receipt;
        } catch (err) {
            const msg = (err.message || "").toLowerCase();
            const errorCode = (err.code || "").toUpperCase();

            // Ha fedezethiány van, vagy a gas becslés elhasal a hiányzó egyenleg miatt (CALL_EXCEPTION / missing revert data)
            if (
                msg.includes("insufficient funds") || 
                msg.includes("exceeds the balance") || 
                msg.includes("sender doesn\'t have enough funds") ||
                msg.includes("missing revert data") ||
                errorCode === "CALL_EXCEPTION"
            ) {
                // Megpróbáljuk lekérni a nyelvi modulból, ha elérhető a GeryApp-on keresztül
 //               const langManager = window.GeryApp?.modules?.language;
                
                // Megpróbáljuk lekérni, de ha az eredmény ugyanaz mint a kulcs (vagy üres), akkor a magyar fallback lép életbe
                let errorText = langManager ? langManager.t("insufficient_funds_error") : "";
                if (!errorText || errorText === "insufficient_funds_error") {
                    errorText = "A csatlakoztatott tárcában nincs elég fedezet";
                }                
                throw new Error(errorText);
            }
            throw err; // Egyéb hiba esetén viszi tovább az eredetit
        }
    }
}