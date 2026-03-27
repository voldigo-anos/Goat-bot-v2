const axios = require("axios");
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const { getStreamFromURL } = global.utils;

async function generatePinterestCanvas(imageObjects, query, page, totalPages) {
  const canvasWidth = 800;
  const canvasHeight = 1600;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('🔍 Recherche Pinterest', 20, 45);

  ctx.font = '16px Arial';
  ctx.fillStyle = '#b0b0b0';
  ctx.fillText(`Résultats de recherche pour "${query}", affichant jusqu'à ${imageObjects.length} images.`, 20, 75);

  const numColumns = 3;
  const padding = 15;
  const columnWidth = (canvasWidth - (padding * (numColumns + 1))) / numColumns;
  const columnHeights = Array(numColumns).fill(100);

  const loadedPairs = await Promise.all(
    imageObjects.map(obj =>
      loadImage(obj.url)
        .then(img => ({ img, originalIndex: obj.originalIndex, url: obj.url }))
        .catch(e => {
          console.error(`Impossible de charger l'image : ${obj.url}`, e && e.message);
          return null;
        })
    )
  );

  const successful = loadedPairs.filter(x => x !== null);

  if (successful.length === 0) {
    ctx.fillStyle = '#ff6666';
    ctx.font = '16px Arial';
    ctx.fillText(`Aucune image n'a pu être chargée pour cette page.`, 20, 110);
    const outputPath = path.join(__dirname, 'cache', `pinterest_page_${Date.now()}.png`);
    await fs.ensureDir(path.dirname(outputPath));
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    return { outputPath, displayedMap: [] };
  }

  let displayNumber = 0;
  const displayedMap = [];

  for (let i = 0; i < successful.length; i++) {
    const { img, originalIndex } = successful[i];

    const minHeight = Math.min(...columnHeights);
    const columnIndex = columnHeights.indexOf(minHeight);

    const x = padding + columnIndex * (columnWidth + padding);
    const y = minHeight + padding;

    const scale = columnWidth / img.width;
    const scaledHeight = img.height * scale;

    ctx.drawImage(img, x, y, columnWidth, scaledHeight);

    displayNumber += 1;
    displayedMap.push(originalIndex);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, 50, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${displayNumber}`, x + 25, y + 12);

    ctx.fillStyle = '#b0b0b0';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${img.width} x ${img.height}`, x + columnWidth - 6, y + scaledHeight - 6);

    columnHeights[columnIndex] += scaledHeight + padding;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  const footerY = Math.max(...columnHeights) + 40;
  ctx.fillText(`Anchestor - Page ${page}/${totalPages}`, canvasWidth / 2, footerY);

  const outputPath = path.join(__dirname, 'cache', `pinterest_page_${Date.now()}.png`);
  await fs.ensureDir(path.dirname(outputPath));
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  return { outputPath, displayedMap };
}

module.exports = {
  config: {
    name: "pinterest",
    aliases: ["Pinterest", "pin"],
    version: "2.2",
    author: "Christus",
    countDown: 10,
    role: 0,
    shortDescription: "Rechercher des images sur Pinterest",
    longDescription: "Recherche des images sur Pinterest, avec un aperçu en canvas pour naviguer.",
    category: "Image",
    guide: {
      en: "{pn} requête [-count]\n" +
        "• Si count est utilisé, les images sont envoyées directement.\n" +
        "• Sans count, une vue canvas interactive s'affiche.\n" +
        "• Exemple : {pn} cute cat -5 (envoi direct)\n" +
        "• Exemple : {pn} anime wallpaper (vue canvas)"
    }
  },

  onStart: async function({ api, args, message, event }) {
    let processingMessage = null;
    try {
      let count = null;
      const countArg = args.find(arg => /^-\d+$/.test(arg));
      if (countArg) {
        count = parseInt(countArg.slice(1), 10);
        args = args.filter(arg => arg !== countArg);
      }
      const query = args.join(" ").trim();
      if (!query) {
        return message.reply("Veuillez fournir une requête de recherche.");
      }

      processingMessage = await message.reply("🔍 Recherche sur Pinterest...");

      const res = await axios.get(`https://egret-driving-cattle.ngrok-free.app/api/pin?query=${encodeURIComponent(query)}&num=90`);
      const allImageUrls = res.data.results || [];

      if (allImageUrls.length === 0) {
        if (processingMessage) await message.unsend(processingMessage.messageID).catch(() => { });
        return message.reply(`Aucune image trouvée pour "${query}".`);
      }

      if (count) {
        const urls = allImageUrls.slice(0, count);
        const streams = await Promise.all(urls.map(url => getStreamFromURL(url).catch(() => null)));
        const validStreams = streams.filter(s => s);

        if (processingMessage) await message.unsend(processagingMessage.messageID).catch(() => { });

        return message.reply({
          body: `Voici ${validStreams.length} image(s) pour "${query}" :`,
          attachment: validStreams
        });

      } else {
        const imagesPerPage = 21;
        const totalPages = Math.ceil(allImageUrls.length / imagesPerPage);
        const startIndex = 0;
        const endIndex = Math.min(allImageUrls.length, imagesPerPage);
        const imagesForPage1 = allImageUrls.slice(startIndex, endIndex).map((url, idx) => ({
          url,
          originalIndex: startIndex + idx
        }));

        const { outputPath: canvasPath, displayedMap } = await generatePinterestCanvas(imagesForPage1, query, 1, totalPages);

        const sentMessage = await message.reply({
          body: `🖼️ ${allImageUrls.length} images trouvées pour "${query}".\nRépondez avec un numéro (affiché sur le canvas) pour obtenir l’image, ou “next” pour plus.`,
          attachment: fs.createReadStream(canvasPath)
        });

        fs.unlink(canvasPath, (err) => {
          if (err) console.error(err);
        });

        global.GoatBot.onReply.set(sentMessage.messageID, {
          commandName: this.config.name,
          author: event.senderID,
          allImageUrls,
          query,
          imagesPerPage,
          currentPage: 1,
          totalPages,
          displayedMap,
          displayCount: Array.isArray(displayedMap) ? displayedMap.length : 0
        });

        if (processingMessage) await message.unsend(processingMessage.messageID).catch(() => { });
      }

    } catch (error) {
      console.error(error);
      if (processingMessage) {
        try { await message.unsend(processingMessage.messageID); } catch (e) { }
      }
      message.reply("Une erreur est survenue. Le serveur ou l'API peut être indisponible.");
    }
  },

  onReply: async function({ api, event, message, Reply }) {
    try {
      if (!Reply) return message.reply("Session expirée. Veuillez relancer la commande.");

      const { author, allImageUrls, query, imagesPerPage, currentPage, totalPages, displayedMap, displayCount } = Reply;
      if (event.senderID !== author) return;

      const input = (event.body || "").trim().toLowerCase();

      if (input === 'next') {
        if (currentPage >= totalPages) {
          return message.reply("Vous êtes déjà sur la dernière page des résultats.");
        }
        const nextPage = currentPage + 1;
        const startIndex = (nextPage - 1) * imagesPerPage;
        const endIndex = Math.min(startIndex + imagesPerPage, allImageUrls.length);

        const imagesForNextPage = allImageUrls.slice(startIndex, endIndex).map((url, idx) => ({
          url,
          originalIndex: startIndex + idx
        }));

        const processingMessage = await message.reply(`Chargement de la page ${nextPage}...`);
        const { outputPath: canvasPath, displayedMap: nextDisplayedMap } = await generatePinterestCanvas(imagesForNextPage, query, nextPage, totalPages);

        const sentMessage = await message.reply({
          body: `🖼️ Page ${nextPage}/${totalPages}.\nRépondez avec un numéro (du canvas) pour obtenir l’image, ou “next” pour continuer.`,
          attachment: fs.createReadStream(canvasPath)
        });
        fs.unlink(canvasPath, (err) => {
          if (err) console.error(err);
        });

        await message.unsend(processingMessage.messageID).catch(() => { });

        global.GoatBot.onReply.set(sentMessage.messageID, {
          commandName: this.config.name,
          author,
          allImageUrls,
          query,
          imagesPerPage,
          currentPage: nextPage,
          totalPages,
          displayedMap: nextDisplayedMap,
          displayCount: Array.isArray(nextDisplayedMap) ? nextDisplayedMap.length : 0
        });

      } else {
        const number = parseInt(input, 10);
        if (!isNaN(number) && number > 0) {
          if (!Array.isArray(displayedMap) || typeof displayCount !== 'number') {
            return message.reply("Les images de cette page ne sont plus disponibles. Relancez la commande ou tapez “next”.");
          }

          if (number > displayCount) {
            return message.reply(`Numéro invalide. Le canvas actuel affiche seulement ${displayCount} image(s). Choisissez un numéro de 1 à ${displayCount}, ou tapez “next” pour charger plus.`);
          }

          const originalIndex = displayedMap[number - 1];
          if (originalIndex == null || originalIndex < 0 || originalIndex >= allImageUrls.length) {
            return message.reply(`Impossible de trouver cette image. Réessayez avec un autre numéro.`);
          }
          const imageUrl = allImageUrls[originalIndex];
          const stream = await getStreamFromURL(imageUrl).catch(() => null);
          if (!stream) return message.reply("Impossible de récupérer l'image demandée.");
          await message.reply({
            body: `Image #${number} pour la requête "${query}" :`,
            attachment: stream
          });
        } else {
          return message.reply(`Répondez avec un numéro (du canvas) pour obtenir l’image, ou “next” pour charger d’autres pages.`);
        }
      }
    } catch (error) {
      console.error(error);
      message.reply("Une erreur est survenue lors du traitement de votre réponse.");
    }
  }
};
