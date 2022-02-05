// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'firestore'... Remove this comment to see the full error message
const firestore = require('../utils/firestore')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'stocksMode... Remove this comment to see the full error message
const stocksModel = firestore.collection('stocks')
const transactionsModel = firestore.collection('transactions')
const tradeLogsModel = firestore.collection('trade-logs')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'fetchWalle... Remove this comment to see the full error message
const { fetchWallet, updateWallet } = require('../models/wallets')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'fetchUserS... Remove this comment to see the full error message
const { fetchUserStocks, updateUserStocks } = require('../models/stocks')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'DINERO'.
const { DINERO } = require('../constants/wallets')

const INSUFFICIENT_FUNDS = 'Trade was not successful due to insufficient funds'
const INSUFFICIENT_QUANTITIES = 'Trade was not successful because you do not have enough quantity'

/**
 * Updates the stock Price
 *
 * @param stockPrice { number }: Stock price
 * @return {stockPrice: number}
 */
const getUpdatedPrice = (stockPrice: any) => {
  // We will be adding logic to update the stock price each a trading take place
  return stockPrice
}

/**
 * New trade
 *
 * @param tradeData { Object }: new trading data
 * @return {Promise<{taskId: string}>}
 */
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'trade'.
const trade = async (tradeData: any) => {
  // ! TODO - update as per curreny type, currently only using dinero
  try {
    const { stockId, stockName, quantity, tradeType, totalPrice, userId } = tradeData
    const stockCollection = await stocksModel.doc(stockId).get()
    const stockData = stockCollection.data()
    let userBalance = 0
    let quantityToUpdate = 0
    let qtyUserCanPurchase = quantity
    let userStocksQty = 0
    let initialStockValue = stockData.price

    const { currencies } = await fetchWallet(userId)
    const userStocks = await fetchUserStocks(userId, stockId)
    const updatedCurrencyData = {}

    if (!currencies) {
      return { canUserTrade: false, errorMessage: INSUFFICIENT_FUNDS }
    }

    switch (tradeType) {
      case 'SELL': {
        if (!userStocks.id || userStocks.quantity < quantity) {
          return { canUserTrade: false, errorMessage: INSUFFICIENT_QUANTITIES }
        }

        quantityToUpdate = quantity + stockData.quantity
        userBalance = (quantity * stockData.price) + currencies[`${DINERO}`]
        userStocksQty = userStocks.quantity - quantity
        break
      }
      case 'BUY': {
        qtyUserCanPurchase = Math.floor(totalPrice / stockData.price)
        if (qtyUserCanPurchase <= 0 || totalPrice > currencies[`${DINERO}`]) {
          return { canUserTrade: false, errorMessage: INSUFFICIENT_FUNDS }
        }
        quantityToUpdate = stockData.quantity - qtyUserCanPurchase
        userBalance = currencies[`${DINERO}`] - (qtyUserCanPurchase * stockData.price)
        userStocksQty = qtyUserCanPurchase

        initialStockValue = stockData.price

        if (userStocks.id) {
          userStocksQty = userStocks.quantity + qtyUserCanPurchase
          initialStockValue = userStocks.initialStockValue
        }
        break
      }
      default: {
        return { canUserTrade: false, errorMessage: 'Invalid trade type' }
      }
    }

    const orderValue = qtyUserCanPurchase * stockData.price
    const stockPriceToBeUpdated = getUpdatedPrice(stockData.price)
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    updatedCurrencyData[`${DINERO}`] = userBalance

    const updatedStockData = {
      ...stockData,
      quantity: quantityToUpdate,
      price: stockPriceToBeUpdated
    }

    // Update user stocks

    await updateUserStocks(userId, {
      stockId,
      stockName,
      quantity: userStocksQty,
      orderValue: userStocksQty * stockData.price,
      initialStockValue
    })

    // Transaction Log

    const { id } = await tradeLogsModel.add({
      type: `STOCK_${tradeType}`,
      userId: userId,
      stockName: stockData.name,
      orderValue,
      quantity: qtyUserCanPurchase,
      price: stockData.price,
      timestamp: +Date.now()
    })

    await transactionsModel.add({
      userId: userId,
      type: `STOCK_${tradeType}`,
      refId: id,
      timestamp: +Date.now()
    })

    // update user wallet

    await updateWallet(userId, {
      ...currencies,
      ...updatedCurrencyData
    })

    await stocksModel.doc(stockId).set(updatedStockData)
    return { userBalance, canUserTrade: true }
  } catch (err) {
    logger.error('Error in trading', err)
    throw err
  }
}

// @ts-expect-error ts-migrate(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
  trade
}
