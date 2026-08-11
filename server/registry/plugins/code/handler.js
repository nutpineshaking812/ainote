import { getQuickJS } from 'quickjs-emscripten';

/**
 * 安全的 JavaScript 脚本执行插件
 * @param {Object} params 用户在节点配置的输入数据 (包含 code 字段)
 * @param {Object} ctx 平台提供的上下文 (包含了上游传下来的全局 trigger/node 数据作为 ctx.triggerData 等，我们可以包装成 input 传入沙箱)
 */
export async function handler(params, ctx) {
  const { code } = params;

  if (!code || !code.trim()) {
    throw new Error('Code content cannot be empty.');
  }

  ctx.logger.info('[Plugin/Code] Initializing QuickJS sandbox...');

  const QJS = await getQuickJS();
  const vm = QJS.newContext();

  try {
    // 1. 获取全局上下文数据，准备作为 `input` 全局变量注入到沙箱中
    // 结合平台规范，通常平台会在 ctx.triggerData 或直接在 params 传入完整的全局变量
    // 这里我们把 params (包含其它输入的字段) 以及 ctx.triggerData 的合并集作为 input 传入，供用户使用
    const inputData = {
      ...ctx.triggerData,
      ...params
    };
    
    // 移除 code 字段本身，防止 input 里包含冗余的 code 串
    delete inputData.code;

    const jsonString = JSON.stringify(inputData);
    const inputHandle = vm.newString(jsonString);

    const parseHandle = vm.getProp(vm.global, 'JSON');
    const parseFn = vm.getProp(parseHandle, 'parse');
    const inputObjHandle = vm.callFunction(parseFn, vm.undefined, inputHandle);

    vm.setProp(vm.global, 'input', inputObjHandle);

    inputHandle.dispose();
    parseHandle.dispose();
    parseFn.dispose();
    inputObjHandle.dispose();

    // 2. 注入安全的 console.log 和 log 函数方便调试
    const logLogs = [];
    const logFn = (...args) => {
      const nativeArgs = args.map(arg => vm.dump(arg));
      ctx.logger.info({ logs: nativeArgs }, '[Plugin/Code/Log] User console log');
      const messageStr = nativeArgs.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
      logLogs.push(messageStr);

      // 实时广播 node:log 事件到 SSE 长连接，实现前端控制台实时打印
      if (typeof ctx.sendConsoleLog === 'function') {
        ctx.sendConsoleLog(`[Code Console] ${messageStr}`);
      }

    };

    const logHandle = vm.newFunction('log', logFn);
    vm.setProp(vm.global, 'log', logHandle);
    logHandle.dispose();


    // 注入 console.handle 支持 console.log 习惯
    const consoleHandle = vm.newObject();
    const consoleLogHandle = vm.newFunction('log', logFn);
    vm.setProp(consoleHandle, 'log', consoleLogHandle);
    vm.setProp(vm.global, 'console', consoleHandle);
    
    consoleHandle.dispose();
    consoleLogHandle.dispose();


    // 3. 执行用户编写的代码（使用 IIFE 包裹）
    const wrappedCode = `
      (function() {
        ${code}
      })()
    `;

    // 限制单次执行的最长 CPU 运行时为 200 毫秒以防止死循环挂死服务器
    const result = vm.evalCode(wrappedCode, {
      maxRuntimeMs: 200,
    });

    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      throw new Error(`Execution error: ${error.message || String(error)}`);
    }

    const output = vm.dump(result.value);
    result.value.dispose();

    // Programmatically guarantee the output format matches { result: output }
    // If output is not already an object containing a 'result' key, wrap it.
    let finalOutput = output;
    if (output === null || typeof output !== 'object' || !('result' in output)) {
      finalOutput = { result: output };
    }

    return {
      success: true,
      result: finalOutput
    };


  } catch (err) {
    ctx.logger.error({ err: err.stack || err }, '[Plugin/Code] Sandboxed execution failed');
    throw err;
  } finally {
    // 确保释放 WebAssembly 实例占用的堆内存防止泄漏
    vm.dispose();
  }
}
