
import { parseEscPosToHtml } from "./utils/escposParser"
import { generateReceipt } from "./utils/generateReceipt"

(async () => {
  const receiptData = await generateReceipt("rcp-cancel", {
    hospitalName: "테스트병원",
    manager: "홍길동",
    address: "서울시 어딘가",
    tel: "02-123-4567",
    date: "2025-07-17",
    cardNo: "1234-5678-9012-3456",
    cardName: "비자카드",
    approvalNo: "987654",
    supplyAmount: "10000",
    surtaxAmount: "1000",
    tax: "1000",
    totalAmount: "11000",
    cardAmount: "11000",
    serialNumber: "A1B2C3D4",
    cancelNumber: "CANCEL1234",
    cancelDate: "2025-07-17",
    tid: "T123456",
    bizNo: "123-45-67890",
    hospitalNo: "H001",
    rs13: "RS13",
    rs14: "RS14",
    items: [{ name: "시술A", amount: "10000" }]
  });

  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `<div id="receipt"></div>`

  const html = parseEscPosToHtml(new TextEncoder().encode(receiptData.replace(/^EP/, "")));
  document.getElementById("receipt")?.appendChild(html);
})();
