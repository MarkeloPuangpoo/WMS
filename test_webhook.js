const fetch = require('node-fetch');

async function testWebhook() {
    console.log("Testing POST /api/webhooks/orders...");

    const payload = {
        order_number: "SHP-" + Math.floor(Math.random() * 1000000),
        customer_name: "John Doe (Shopee)",
        external_source: "Shopee",
        items: [
            // We need SKUs that actually exist in the DB.
            // Assuming TS-BLK-M and SH-WHT-9 exist based on early phases
            { sku: "TS-BLK-M", quantity: 2 },
            { sku: "SH-WHT-9", quantity: 1 }
        ]
    };

    try {
        const response = await fetch("http://localhost:3000/api/webhooks/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // This is a test token, will fail if we haven't seeded api_keys
                "Authorization": "Bearer TEST-TOKEN-123"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log("Response:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testWebhook();
