import { BrowserWindow, ipcMain } from 'electron';

/**
 * DOM 探测工具 - 用于分析创作者中心页面结构
 * 后续可以删掉
 */
export function registerDomInspector(): void {
    ipcMain.handle('debug:openCreator', async (_, accountId: string = 'test') => {
        const win = new BrowserWindow({
            width: 1200,
            height: 900,
            title: '调试 - 抖音创作者中心',
            webPreferences: {
                partition: `persist:dy_${accountId}`,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        await win.loadURL('https://creator.douyin.com/creator-micro/content/publish');

        // 打开开发者工具，方便你查看 DOM
        win.webContents.openDevTools();

        // 3秒后自动提取页面关键元素信息
        setTimeout(async () => {
            const domInfo = await win.webContents.executeJavaScript(`
        (function() {
          const result = {
            url: window.location.href,
            title: document.title,
            inputs: [],
            buttons: [],
            fileInputs: [],
            editors: [],
          };
 
          // 所有 input
          document.querySelectorAll('input').forEach(el => {
            result.inputs.push({
              tag: 'input',
              type: el.type,
              className: el.className,
              placeholder: el.placeholder,
              name: el.name,
              id: el.id,
              accept: el.accept,
            });
          });
 
          // 所有按钮
          document.querySelectorAll('button, [role="button"], [class*="btn"], [class*="publish"]').forEach(el => {
            result.buttons.push({
              tag: el.tagName,
              className: el.className,
              text: el.innerText?.trim()?.substring(0, 50),
              id: el.id,
            });
          });
 
          // 所有 file input
          document.querySelectorAll('input[type="file"]').forEach(el => {
            result.fileInputs.push({
              className: el.className,
              accept: el.accept,
              multiple: el.multiple,
              id: el.id,
            });
          });
 
          // 富文本编辑器
          document.querySelectorAll('[contenteditable="true"], .ql-editor, [class*="editor"]').forEach(el => {
            result.editors.push({
              tag: el.tagName,
              className: el.className,
              contentEditable: el.contentEditable,
              placeholder: el.dataset?.placeholder || '',
              id: el.id,
            });
          });
 
          return result;
        })()
      `);

            console.log('========== 创作者中心 DOM 结构 ==========');
            console.log('URL:', domInfo.url);
            console.log('\n📝 编辑器:', JSON.stringify(domInfo.editors, null, 2));
            console.log('\n📁 文件上传:', JSON.stringify(domInfo.fileInputs, null, 2));
            console.log('\n🔘 按钮:', JSON.stringify(domInfo.buttons, null, 2));
            console.log('\n📋 输入框:', JSON.stringify(domInfo.inputs, null, 2));
            console.log('========================================');
        }, 5000);

        return true;
    });
}