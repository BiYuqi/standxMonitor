require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
// const cron = require('node-cron');

// 配置（替换为你的值）
const BOT_TOKEN = process.env.BOT_TOKEN; // 从 @BotFather 获取
const CHANNEL_ID = process.env.CHANNEL_ID; // 你的频道 ID，注意是负数开头
const DUSD_ID = 'standx-dusd'; // CoinGecko 上的 DUSD ID
const DINGTALK_WEBHOOK =  process.env.DINGTALK_WEBHOOK; // 你的钉钉机器人 Webhook

// 初始化 Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// 函数：获取 DUSD 价格和 APY
async function fetchDUSDData() {
  try {
    // 配置 axios 请求，添加 User-Agent
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: DUSD_ID,
        vs_currencies: 'usd',
        include_24hr_change: true,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 秒超时
    });

    const price = response.data[DUSD_ID].usd;
    const change24h = response.data[DUSD_ID].usd_24h_change;

    return { price: parseFloat(price), change24h: parseFloat(change24h)};
  } catch (error) {
    console.error('Error fetching data:', error.response?.status, error.message);
    return null;
  }
}

// 函数：检查脱锚并发送 TG 消息
async function checkAndNotify() {
  const data = await fetchDUSDData();
  if (!data) {
    // bot.sendMessage(CHANNEL_ID, '⚠️ 无法获取 DUSD 数据，请检查 API！');
    return;
  }

  const baseMessage = `🪙 DUSD 监控更新\n💰 当前价格: $${data.price.toFixed(4)} USD\n📈 24h 变化: ${data.change24h.toFixed(4)}%\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`;

  let alert = '';
  if (data.price < 0.995) {
    alert = '\n🚨 警告：DUSD 脱锚（低于 0.995 USD）！';
  } else if (data.price > 1.005) {
    alert = '\n🚨 警告：DUSD 脱锚（高于 1.005 USD）！';
  }
  console.log(baseMessage + alert);
  console.log('-----------------------------------');
  // 仅在脱锚时发送通知
  if (alert) {
    // TG 推送
    await sendTGMessage(baseMessage, alert);

    // 钉钉推送（传递 data 对象，便于 Markdown 格式化）
    await sendDingTalkMessage(data, alert);
  }
}

// 函数：发送 TG 消息（原有逻辑）
async function sendTGMessage(message, alert = '') {
  const fullMessage = message + alert;
  bot.sendMessage(CHANNEL_ID, fullMessage)
    .then(() => console.log('TG 消息发送成功'))
    .catch(err => console.error('TG 发送失败:', err.message));
}

// 函数：发送钉钉消息（Markdown 格式）
async function sendDingTalkMessage(message, alert = '') {
  // 加签逻辑（如果启用）
  let webhook = DINGTALK_WEBHOOK;

  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: '🪙 DUSD 监控更新', // 标题（钉钉显示）
      text: `**💰 当前价格:** $${message.price.toFixed(4)} USD  \n**📈 24h 变化:** ${message.change24h.toFixed(4)}%  \n**\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`
    },
    at: {
      atMobiles: [], // 可填手机号 @ 特定人
      isAtAll: false // true 为 @ 所有人（脱锚时可选）
    }
  };

  try {
    const response = await axios.post(webhook, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    if (response.data.errcode === 0) {
      console.log('钉钉消息发送成功');
    } else {
      console.error('钉钉发送失败:', response.data.errmsg);
    }
  } catch (error) {
    console.error('钉钉发送错误:', error.response?.status, error.message);
  }
}


// 定时任务：每 5 分钟执行一次
// cron.schedule('*/5 * * * *', checkAndNotify);

// 首次运行
checkAndNotify();

console.log('DUSD 监控启动，每 5 分钟检查一次...');