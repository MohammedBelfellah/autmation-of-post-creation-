const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Helper function to validate filenames
const isValidFilename = (filename) => {
  return /^processed_image_\d+\.jpg$/.test(filename);
};

app.post("/generate-post", async (req, res) => {
  const {
    imageUrl,
    logoUrl,
    text01,
    focusText,
    text02,
    direction,
    language,
    focusTextColor,
  } = req.body;

  if (!imageUrl || !logoUrl || !text01 || !focusText || !text02) {
    return res.status(400).json({
      error:
        "imageUrl, logoUrl, text01, focusText, and text02 are all required.",
    });
  }

  const textDirection = direction || "ltr";
  const textLanguage = language || "en";
  const focusColor = focusTextColor || "#FF4500";

  try {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="${textLanguage}" dir="${textDirection}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          position: relative;
        }
        .container {
          position: relative;
          width: 1080px;
          height: 1080px;
          overflow: hidden;
        }
        .image {
          width: 100%;
          height: 100%;
          background-image: url('${imageUrl}');
          background-size: cover;
          background-position: center;
          filter: brightness(0.7);
        }
        .overlay-top, .overlay-bottom {
          position: absolute;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
        }
        .overlay-bottom {
          bottom: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
        }
        .overlay-top {
          top: 0;
        }
        .logo {
          position: absolute;
          top: 20px;
          ${textDirection === "rtl" ? "left: 20px;" : "right: 20px;"}
          width: 100px;
          height: 100px;
          background-image: url('${logoUrl}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        .text-overlay {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          width: 90%;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          direction: ${textDirection};
        }
        .text {
          color: white;
          font-size: 64px;
          font-weight: bold;
          text-shadow: 2px 2px 10px rgba(0, 0, 0, 0.7);
          margin: 0 10px;
          line-height: 1.2;
        }
        .focus-text {
          background-color: ${focusColor};
          color: white;
          font-size: 64px;
          font-weight: bold;
          padding: 15px 25px;
          border-radius: 10px;
          display: inline-block;
          margin: 0 20px;
          box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
          text-shadow: 3px 3px 15px rgba(0, 0, 0, 0.8);
        }
        .bottom-right-lines {
          position: absolute;
          bottom: 20px;
          right: -45px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .line {
          width: 350px;
          height: 8px;
          background-color: ${focusColor};
          margin: 10px 0;
          transform: rotate(-220deg);
        }
        .line-2 {
          width: 350px;
          height: 8px;
          background-color: #ffffff;
          margin: 10px 0;
          transform: rotate(-220deg);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="image"></div>
        <div class="overlay-top"></div>
        <div class="overlay-bottom"></div>
        <div class="logo"></div>
        <div class="text-overlay">
          <div class="text">${text01}</div>
          <div class="focus-text">${focusText}</div>
          <div class="text">${text02}</div>
        </div>
        <div class="bottom-right-lines">
          <div class="line"></div>
          <div class="line-2"></div>
        </div>
      </div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.setViewport({ width: 1080, height: 1080 });

    const fileName = `processed_image_${Date.now()}.jpg`;
    const filePath = path.join(publicDir, fileName);
    await page.screenshot({
      path: filePath,
      type: "jpeg",
      quality: 100,
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
    await browser.close();

    const savedImageUrl = `${req.protocol}://${req.get("host")}/${fileName}`;
    res.json({ imageUrl: savedImageUrl, fileName: fileName });
  } catch (error) {
    console.error("Error processing image:", error.message);
    res.status(500).json({ error: "Failed to process the image." });
  }
});

// API endpoint to delete an image
app.delete("/delete-image", (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: "fileName is required." });
  }

  if (!isValidFilename(fileName)) {
    return res.status(400).json({ error: "Invalid file name." });
  }

  const filePath = path.join(publicDir, fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: "File does not exist." });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ error: "Failed to delete the file." });
      }

      res.json({ message: "File deleted successfully." });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
