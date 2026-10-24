import asyncio, os
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo

load_dotenv()
TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
dp = Dispatcher()

@dp.message(CommandStart())
async def start(message: Message):
    if not WEBAPP_URL.startswith("https://"):
        await message.answer("Администратору нужно настроить WEBAPP_URL с публичным HTTPS адресом Mini App.")
        return
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🎬 Открыть MediaVerse", web_app=WebAppInfo(url=WEBAPP_URL))]],
        resize_keyboard=True
    )
    await message.answer(
        "Добро пожаловать в MediaVerse Cinema!\n"
        "Здесь размещается каталог видео, на распространение которых у владельца есть права. "
        "Нажми кнопку, чтобы открыть мини-приложение.",
        reply_markup=keyboard
    )

async def main():
    if not TOKEN:
        raise RuntimeError("Укажите BOT_TOKEN в .env")
    await dp.start_polling(Bot(TOKEN))

if __name__ == "__main__":
    asyncio.run(main())
