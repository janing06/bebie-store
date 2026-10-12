export type FieldHelp = { bisaya: string; english: string }

export const FIELD_HELP = {
  name: {
    bisaya: 'Ngalan sa produkto nga makita sa Sell. Pananglitan: Coke 1.5L.',
    english: 'Product name shown on the Sell screen.',
  },
  price: {
    bisaya: 'Presyo kada piraso nga ibaligya nimo sa customer.',
    english: 'Selling price for one piece.',
  },
  cost: {
    bisaya: 'Pila ang palit nimo kada piraso (puhunan). Para makita ang ganansya.',
    english: 'What you paid for one piece, used to compute profit.',
  },
  startingStock: {
    bisaya: 'Pila ka piraso ang naa karon sa tindahan.',
    english: 'How many pieces you have right now.',
  },
  lowStockAt: {
    bisaya:
      'Mo-warning ang app kung ingon ani na lang ka daghan ang nabilin, para kahibaw ka kanus-a mopalit.',
    english: 'The app warns you when stock drops to this number, so you know when to buy more.',
  },
  packSize: {
    bisaya:
      'Pila ka piraso sa usa ka pack. Pananglitan: sigarilyo, 20 ka stick. Biyai og blangko kung dili ibaligya by pack.',
    english: 'Pieces in one pack, e.g. 20 sticks of cigarettes. Leave blank if not sold by pack.',
  },
  favorite: {
    bisaya: 'Ipakita sa Sell screen para usa ra ka tap. Para sa kanunay mabaligya.',
    english: 'Show on the Sell screen for one-tap selling. For best sellers.',
  },
  restockCost: {
    bisaya:
      'Bag-ong puhunan kung nag-usab ang presyo sa supplier. Biyai og blangko kung pareha ra.',
    english: "New cost if the supplier changed the price. Leave blank if it's the same.",
  },
} satisfies Record<string, FieldHelp>
