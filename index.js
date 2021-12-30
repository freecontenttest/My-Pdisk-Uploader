const { Telegraf } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const axios = require('axios');
axios.defaults.headers.common['X-XSRF-TOKEN'] = process.env.AXIOS_TOKEN;
axios.defaults.headers.common['Cookie'] = process.env.COOKIE;

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is working now !!')
});

app.listen(process.env.PORT || 5001);

bot.use((ctx, next) => {
    const fromId = getFromId(ctx);
    if (!fromId) return;
    if (process.env.SUDO_USERS == fromId) return next();
    else notAllowedMessage(ctx);
});

bot.catch((err, ctx) => {
    const fromId = getFromId(ctx)
    console.log('ctx--catch==========>', err)
    if (!fromId) return;
    if (process.env.SUDO_USERS != fromId) return;
    let mainError;
    if (err.description) mainError = err.description.split(': ')[1];
    else if (typeof (err) == 'string') {
        mainError = err.split(': ')[1];
    }
    if (!mainError) return;
    ctx.reply(mainError);
});

/*
Variables...
*/

var current_pdisk_account = 'online_contents';
var last_item_id = [];

/*
Functions
*/

function getFromId(ctx) {
    if (ctx.message) {
        return ctx.message.from.id
    } else if (ctx.callbackQuery) {
        return ctx.callbackQuery.from.id
    } else if (ctx.inlineQuery) {
        return ctx.inlineQuery.from.id
    } else {
        return null
    }
};

function notAllowedMessage(ctx) {
    if (ctx.updateType == 'message') {
        return ctx.reply('⚠️  You\'re not allowed 🚫️ to message !!!');
    } else if (ctx.updateType == 'callback_query') {
        return ctx.telegram.answerCbQuery(ctx.callbackQuery.id, '⚠️  You\'re not allowed 🚫️ to choose option', true);
    } else if (ctx.updateType == 'inline_query') {
        const results = [{
            type: 'photo',
            id: 1,
            photo_url: 'https://cdn.pixabay.com/photo/2012/04/24/12/29/no-symbol-39767_640.png',
            thumb_url: 'https://cdn.pixabay.com/photo/2012/04/24/12/29/no-symbol-39767_640.png',
            caption: '⚠️  Your\'re not allowed 🚫️ to search anything !!'
        }];
        return ctx.answerInlineQuery(results);
    }
};

async function getItemId (url) {
    const res = await axios.get(url);
    if (res.status === 200) {
        return { itemId: res.request._redirectable._currentUrl.split('videoid=')[1] };
    } else {
        return { error: 'Something Went Wrong !!' };
    };
};

async function cloneVideo (url) {
    const res = await getItemId (url);
    if (res.error) return { error: res.error };
    
    const API = current_pdisk_account === 'online_contents' ? process.env.PDISK_CONTENTS_API : process.env.PDISK_CONTENT_API;
    const response = await axios.post(`http://linkapi.net/open/clone_item?api_key=${API}&item_id=${res.itemId}`);
    const newlink = await axios.post(`https://www.pdisk.net/api/ndisk-api/content/gen_link?itemId=${response.data.data.item_id}`);
    
    if (!newlink.data.isSuccess) {
        return { error: newlink.data.msg };
    };
    return { newURL: newlink.data.data.url, item_id: String(response.data.data.item_id) };
};

function get_cookies () {
    return axios.defaults.headers.common['Cookie'] || 'Not Found !!';
};

function get_xsrf () {
    return axios.defaults.headers.common['X-XSRF-TOKEN'] || 'Not Found !!';
};

async function set_cookie (ID) {
    const params = { "userName": process.env[`${ID}_USERNAME`], "password": process.env[`${ID}_PASSWORD`] };
    try {
        const res = await axios.post('https://www.pdisk.net/api/fleets_accounts/account/pwd_login', params);
        const cookies = res.headers['set-cookie'];
        const arrayOfCookies = cookies.map(cookie => cookie.split(';')[0]);
        
        const xsrf_token = arrayOfCookies.filter(cookie => cookie.includes('csrfToken='));
        axios.defaults.headers.common['X-XSRF-TOKEN'] = xsrf_token[0].split('csrfToken=')[1];
        
        var set_cookies = arrayOfCookies.join('; ');
        axios.defaults.headers.common['Cookie'] = set_cookies;
        return `Successfully set cookies\n\n\`${get_cookies()}\``;
    } catch (error) {
        console.log('error', error);
        return error;
    };
};

/*
Bot
*/

bot.start((ctx) => {
    ctx.reply('Hi !!\n\nWelcome To Pdisk All In One Bot \nOfficial bot of @temp_demo');
});

bot.command('switch_pdisk', (ctx) => {
    if (current_pdisk_account === 'online_contents') current_pdisk_account = 'online_content';
    else current_pdisk_account = 'online_contents';
    ctx.reply(`Main account is switched to ${current_pdisk_account}`);
});

bot.command('current_pdisk', (ctx) => {
    const id = current_pdisk_account === 'online_contents' ? "79542932" : "42211234"
    ctx.reply(`You are currently using this pdisk account \n\n➥ user-name: ${current_pdisk_account}\n➥ user-id: ${id}`);
});

bot.command('show_cookies', (ctx) => {
    ctx.reply(`Here is your cookies:\n\n\`${get_cookies()}\``, {
        parse_mode: 'markdown',
    });
});

bot.command('show_xsrf', (ctx) => {
    ctx.reply(`Here is your xsrf token:\n\n\`${get_xsrf()}\``, {
        parse_mode: 'markdown',
    });
});

bot.command('login_online_content', async (ctx) => {
    const response = await set_cookie('online_content'.toUpperCase());
    ctx.reply(response, {
        parse_mode: 'markdown',
    });
});

bot.command('login_online_contents', async (ctx) => {
    const response = await set_cookie('online_contents'.toUpperCase());
    ctx.reply(response, {
        parse_mode: 'markdown',
    });
});

let finalData = [];
let timeout = 1000;

async function inQueue (list, ctx) {
    setTimeout(async () => {
        timeout += 1000;
        console.log('timeout=========>', timeout)
        console.log('list===========>', list);
        if (list.length == 0) {
            return finalData.forEach(link => {
                ctx.reply(`\`${link}\`\n\n${link}`, { parse_mode: 'markdown' })
            });
        };
        const res = await cloneVideo (list[0]);
        if (res.error) inQueue(list, ctx);
        finalData.push(res.newURL);
        list.shift()
        inQueue(list, ctx);
    }, timeout);
};

bot.command('daily_tv_shows', async (ctx) => {
    let repliedMsg = ctx.message.text.split(' ')[1] || ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '';

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const compareTo = ['kuklink', 'cofilink', 'pdisk', 'pdisk1', 'kofilink', 'pdisklink', 'vdshort', 'pdisks', 'wslinker', 'cdinks'];
    const allURLs = repliedMsg.match(urlRegex);
    
    if (allURLs && allURLs.length > 0) repliedMsg = allURLs.filter(url => compareTo.some(str => url.includes(str)));
    
    if (!repliedMsg || repliedMsg.length < 1) return ctx.reply('Please send valid links !!!')
    
    finalData = [];
    timeout = 1000;
    inQueue (repliedMsg, ctx);
});

bot.launch();
