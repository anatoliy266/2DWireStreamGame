export function printMessage(message: string, user: string = "SYSTEM") {
    // Проверка на наличие DOM (для запуска вне браузера без ошибок)
    if (typeof document === 'undefined') {
        console.log(`[${user}] ${message}`);
        return;
    }

    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    const messageItem = document.createElement('li');
    messageItem.className = 'message-box';
    const userColor = user === "SYSTEM" ? '#00ff00' : '#dad607';

    messageItem.innerHTML = `
        <span class="username" style="color: ${userColor}">${user}:</span>
        <span class="text">${message}</span>
    `;

    chatContainer.prepend(messageItem);

    if (chatContainer.children.length > 50 && chatContainer.lastChild) {
        chatContainer.lastChild.remove();
    }
}