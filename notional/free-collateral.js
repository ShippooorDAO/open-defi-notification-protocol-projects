const Notional = require('@notional-finance/sdk-v2');

/**
 * @typedef FreeCollateralParams
 * @property {Number} debt
 * @property {Number} collateral
 * @property {Number} freeCollateral
 */

const amountFormatter = Intl.NumberFormat('en', { notation: 'compact' });

/**
 * Get notified when free collateral on your Notional V2 account gets below set threshold.
 * 
 * This notification aims to prevent account liquidation.
 * https://docs.notional.finance/notional-v2/risk-and-collateralization/liquidation
 */
class FreeCollateral {
  static displayName = 'Free Collateral';
  static description =
    'Get notified when free collateral in your account goes under set threshold.';

  /**
   * Runs when class is initialized
   *
   * @param args
   * @returns {Promise<void>}
   */
  async onInit(args) {}

  /**
   * Get free collateral for given account, in USD.
   * @param {string} accountId
   * @returns {FreeCollateral}
   */
  async getFreeCollateral(accountId) {
    const notionalSdk = await Notional.load(1, null);
    const account = await notionalSdk.getAccountFromGraph(accountId);
    const { netETHDebtWithBuffer, netETHCollateralWithHaircut } =
      account.getFreeCollateral();
    const freeCollateralETH =
      netETHCollateralWithHaircut.sub(netETHDebtWithBuffer);
    return {
      debt: Number(netETHDebtWithBuffer.toUSD().toExactString()),
      collateral: Number(netETHCollateralWithHaircut.toUSD().toExactString()),
      freeCollateral: Number(freeCollateralETH.toUSD().toExactString()),
    };
  }

  /**
   * Runs right before user subscribes to new notifications and populates subscription form
   *
   * @param args
   * @returns {Promise<[{values: *[], id: string, label: string, type: string}, {default: number, description: string, id: string, label: string, type: string}]>}
   */
  async onSubscribeForm(args) {
    const { freeCollateral } = await this.getFreeCollateral(args.address);

    return [
      {
        type: 'input-number',
        id: 'free-collateral',
        label: 'Free Collateral',
        default: 1000,
        description: `Notify me when account free collateral drops under X USD. (Currently: ${amountFormatter(
          freeCollateral
        )} USD)`,
      },
    ];
  }

  /**
   * Builds a notification message letting the user know that their account is below set free collateral threshold.
   *
   * @param {FreeCollateralParams} freeCollateral
   * @returns {notification: string, uniqueId: string}
   */
  buildNotification(freeCollateral) {
    return {
      notification: `Your account is low in free collateral and is at risk of getting liquidated. Free collateral: ${amountFormatter.format(
        freeCollateral.freeCollateral
      )} USD | Collateral: ${amountFormatter.format(
        freeCollateral.collateral
      )} USD | Debt: ${amountFormatter.format(freeCollateral.debt)} USD`,
    };
  }

  /**
   * Runs when new blocks are added to the mainnet chain - notification scanning happens here
   *
   * @param args
   * @returns {Promise<*[]|{notification: string, uniqueId: string}>}
   */
  async onBlocks(args) {
    if (!args.subscription) {
      return;
    }

    const freeCollateralThreshold = args.subscription['free-collateral'];
    const accountFreeCollateral = this.getFreeCollateral(args.address);

    if (accountFreeCollateral.freeCollateral < freeCollateralThreshold) {
      return this.buildNotification(accountFreeCollateral);
    }
    return [];
  }
};

module.exports = FreeCollateral;
