/*

https://github.com/david-haerer/chatapi

MIT License

Copyright (c) 2023 David Härer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
function submitKey(event) {
    event.preventDefault();
    localStorage.setItem("key", document.getElementById("apiKey").value);
    document.getElementById("apiKey").blur();
  }
  
  function submitPrompt(event) {
    event.preventDefault();
  
    const input = document.getElementById("input").value;
    Alpine.store("chat").add("user", input);
    document.getElementById("input").value = "";
    const key = localStorage.getItem("key");
  
    if (input.startsWith("!img")) {
      promptDallE(key, input.slice(4));
    } else {
      promptGPT(key, input);
    }
  }
  
  async function promptDallE(key, input) {
    const response = await fetch("/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: input,
        n: 1,
        size: "1792x1024",
      }),
    });
    const json = await response.json();
    const url = json.data[0].url;
    Alpine.store("chat").add("assistant", `![${input}](${url})`);
  }
  
  async function promptGPT(key, input) {
    const model = document.getElementById("chat-model").value;
    // Source: https://stackoverflow.com/a/75751803/11386095
    const response = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: Alpine.store("chat").messages(),
        stream: true,
      }),
    });
  
    if (!response.ok) {
      Alpine.store("chat").add(
        "assistant",
        `<span class='error'>Error: POST /v1/chat/completions ${response.status}</span>`,
      );
      return;
    }
  
    const reader = response.body
      ?.pipeThrough(new TextDecoderStream())
      .getReader();
  
    if (!reader) {
      Alpine.store("chat").add(
        "assistant",
        `<span class='error'>Error: Failed to decode API response</span>`,
      );
      return;
    }
  
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      let dataDone = false;
      const arr = value.split("\n");
      arr.forEach((data) => {
        if (data.length === 0) return;
        if (data.startsWith(":")) return;
        if (data === "data: [DONE]") {
          dataDone = true;
          return;
        }
        const token = JSON.parse(data.substring(6)).choices[0].delta.content;
        if (!token) {
          return;
        }
        hljs.highlightAll();
        Alpine.store("chat").add("assistant", token);
      });
      hljs.highlightAll();
      if (dataDone) break;
    }
  }
  
  document.getElementById("key").addEventListener("submit", submitKey);
  document.getElementById("prompt").addEventListener("submit", submitPrompt);
  document.getElementById("input").focus();
  
  const storeKey = localStorage.getItem("key");
  if (storeKey) {
    document.getElementById("apiKey").value = storeKey;
  }
  
  marked.setOptions({
    highlight: function (code) {
      return hljs.highlightAuto(code).value;
    },
  });