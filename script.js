const customers = [
  { name: "Dima", address: "417 Germain Manor" },
  { name: "Randy Best", address: "1515 Shannon Cres" },
  { name: "Abdul Razzaq", address: "1302 Hunter Road" },
  { name: "Tony", address: "219 Edgemont Crest" },
  { name: "Dawn", address: "905 6th Ave North" },
  { name: "Trudy", address: "219 Greaves Crest" }
];

const tableBody = document.getElementById("tableBody");

for (let i = 0; i < 16; i++) {
  const row = document.createElement("tr");

  const customer = customers[i] || { name: "", address: "" };

  row.innerHTML = `
    <td class="name"><input value="${customer.name}"></td>
    <td class="address"><input value="${customer.address}"></td>
    <td><input type="date"></td>
    <td><input type="date"></td>
    <td><input type="date"></td>
    <td><input type="date"></td>
    <td><input type="date"></td>
    <td><input type="date"></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
    <td><input></td>
  `;

  tableBody.appendChild(row);
}
