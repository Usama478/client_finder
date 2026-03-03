import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error));
    page.on('dialog', async dialog => {
        console.log('BROWSER_DIALOG:', dialog.message());
        await dialog.accept();
    });

    await page.goto('http://localhost:5173/clients');
    await page.waitForTimeout(2000);

    try {
        console.log("Clicking Export All...");
        await page.locator('text=Export All').click();
        await page.waitForTimeout(3000); // Wait for download or error
    } catch (e) {
        console.log("Playwright click failed", e);
    }

    await browser.close();
})();
