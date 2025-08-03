// Google Apps Script - PWA 會議記錄接收器
// 支援兩種資料來源：1. AssemblyAI 版本  2. PWA Gemini 版本

// ⚠️ 重要：請將下面的 YOUR_SPREADSHEET_ID_HERE 替換為您的 Google Sheets ID
const SPREADSHEET_ID = '1KnJ48bmaKYavM1NGMqbuP5vmLazKGRyDK5EQsirnDxk'; // 替換為您的 Google Sheets ID
const SHEET_NAME = '會議記錄';
const SUMMARY_SHEET_NAME = '統計摘要';

// 主要的 POST 請求處理函數
function doPost(e) {
  try {
    // 檢查是否已設定 SPREADSHEET_ID
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE' || !SPREADSHEET_ID) {
      throw new Error('請先設定 SPREADSHEET_ID！');
    }
    
    // 解析接收到的 JSON 資料
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      throw new Error('無法解析接收到的資料：' + parseError.toString());
    }
    
    // 開啟試算表
    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (openError) {
      throw new Error('無法開啟試算表！請確認 SPREADSHEET_ID 是否正確');
    }
    
    // 判斷資料來源並處理
    if (data.source === 'PWA Meeting Recorder') {
      handlePWAData(spreadsheet, data);
    } else if (data.speakers) {
      handleAssemblyAIData(spreadsheet, data);
    } else {
      handleGenericData(spreadsheet, data);
    }
    
    // 回傳成功訊息
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: '資料已成功寫入 Google Sheets',
        sheetUrl: spreadsheet.getUrl()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理 PWA 資料
function handlePWAData(spreadsheet, data) {
  // 取得或建立工作表
  let sheet = getOrCreateSheet(spreadsheet, SHEET_NAME);
  
  // 設定標題列（如果需要）
  if (sheet.getLastRow() === 0) {
    setupPWAHeaders(sheet);
  }
  
  // 準備資料列
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const row = [
    timestamp,                                    // 記錄時間
    data.fileName || '未命名錄音',                 // 檔案名稱
    data.processingTime || timestamp,             // 處理時間
    data.duration || '',                          // 錄音長度
    data.meetingSummary || '',                    // 會議摘要
    formatArray(data.keyPoints),                  // 重要討論點
    formatArray(data.decisions),                  // 決策事項
    formatArray(data.actionItems),                // 行動項目
    formatArray(data.followUp),                   // 後續追蹤
    data.fullTranscript || '',                    // 完整內容
    data.fullTranscript ? data.fullTranscript.length : 0  // 字數統計
  ];
  
  // 寫入資料
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
  
  // 設定格式
  const dataRange = sheet.getRange(lastRow + 1, 1, 1, row.length);
  dataRange.setVerticalAlignment('top');
  dataRange.setWrap(true);
  
  // 更新統計
  updateSummarySheet(spreadsheet, data);
}

// 處理 AssemblyAI 資料
function handleAssemblyAIData(spreadsheet, data) {
  // 使用原有的處理邏輯
  let sheet = getOrCreateSheet(spreadsheet, '語音轉文字記錄');
  
  if (sheet.getLastRow() === 0) {
    setupAssemblyAIHeaders(sheet);
  }
  
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const rows = [];
  
  // 處理每位說話者的資料
  if (data.speakers && typeof data.speakers === 'object') {
    Object.entries(data.speakers).forEach(([speaker, texts]) => {
      const combinedText = Array.isArray(texts) ? texts.join('\n') : texts;
      rows.push([
        timestamp,
        data.fileName || '未知檔案',
        data.processingTime || '',
        `說話者 ${speaker}`,
        combinedText,
        '',
        data.duration || '',
        combinedText.length
      ]);
    });
  }
  
  // 如果有完整文字稿
  if (data.fullTranscript) {
    rows.push([
      timestamp,
      data.fileName || '未知檔案',
      data.processingTime || '',
      '完整文字稿',
      '',
      data.fullTranscript,
      data.duration || '',
      data.fullTranscript.length
    ]);
  }
  
  if (rows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);
  }
}

// 處理一般資料
function handleGenericData(spreadsheet, data) {
  let sheet = getOrCreateSheet(spreadsheet, SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    setupGenericHeaders(sheet);
  }
  
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const row = [
    timestamp,
    JSON.stringify(data)  // 儲存原始資料
  ];
  
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

// 設定 PWA 標題列
function setupPWAHeaders(sheet) {
  const headers = [
    '記錄時間',
    '檔案名稱',
    '處理時間',
    '錄音長度',
    '會議摘要',
    '重要討論點',
    '決策事項',
    '行動項目',
    '後續追蹤',
    '完整內容',
    '字數統計'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 設定標題列格式
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  // 設定欄寬
  sheet.setColumnWidth(1, 150); // 記錄時間
  sheet.setColumnWidth(2, 150); // 檔案名稱
  sheet.setColumnWidth(3, 150); // 處理時間
  sheet.setColumnWidth(4, 100); // 錄音長度
  sheet.setColumnWidth(5, 500); // 會議摘要
  sheet.setColumnWidth(6, 400); // 重要討論點
  sheet.setColumnWidth(7, 400); // 決策事項
  sheet.setColumnWidth(8, 250); // 行動項目
  sheet.setColumnWidth(9, 250); // 後續追蹤
  sheet.setColumnWidth(10, 400); // 完整內容
  sheet.setColumnWidth(11, 600); // 字數統計
}

// 設定 AssemblyAI 標題列
function setupAssemblyAIHeaders(sheet) {
  const headers = [
    '記錄時間',
    '檔案名稱',
    '處理時間',
    '說話者',
    '發言內容',
    '完整文字稿',
    '音檔長度(秒)',
    '總字數'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
}

// 設定一般標題列
function setupGenericHeaders(sheet) {
  const headers = ['記錄時間', '資料內容'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
}

// 取得或建立工作表
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet;
  try {
    sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      // 如果返回 null，建立新工作表
      console.log(`工作表 "${sheetName}" 不存在，建立新工作表...`);
      sheet = spreadsheet.insertSheet(sheetName);
      console.log(`✅ 已建立工作表：${sheetName}`);
    }
  } catch (err) {
    // 如果出錯（工作表不存在），建立新的
    console.log(`建立新工作表：${sheetName}`);
    try {
      sheet = spreadsheet.insertSheet(sheetName);
      console.log(`✅ 已建立工作表：${sheetName}`);
    } catch (insertError) {
      console.error(`❌ 無法建立工作表：${insertError}`);
      throw insertError;
    }
  }
  return sheet;
}

// 格式化陣列資料
function formatArray(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.filter(item => item && item.trim()).join('\n• ');
}

// 更新統計摘要
function updateSummarySheet(spreadsheet, data) {
  try {
    // 確保 spreadsheet 參數存在
    if (!spreadsheet) {
      console.error('錯誤：spreadsheet 參數未提供');
      return;
    }
    
    let summarySheet = getOrCreateSheet(spreadsheet, SUMMARY_SHEET_NAME);
    
    // 初始化摘要表（如果需要）
    if (summarySheet.getLastRow() === 0) {
      const headers = [
        ['統計項目', '數值'],
        ['總處理次數', '0'],
        ['本月處理次數', '0'],
        ['總字數', '0'],
        ['平均錄音長度', '0'],
        ['最後更新時間', '']
      ];
      summarySheet.getRange(1, 1, headers.length, 2).setValues(headers);
      summarySheet.getRange(1, 1, 1, 2).setBackground('#34a853').setFontColor('#ffffff').setFontWeight('bold');
    }
    
    // 更新統計
    const currentCount = parseInt(summarySheet.getRange(2, 2).getValue() || 0);
    const currentWords = parseInt(summarySheet.getRange(4, 2).getValue() || 0);
    const newWords = data && data.fullTranscript ? data.fullTranscript.length : 0;
    
    summarySheet.getRange(2, 2).setValue(currentCount + 1);
    summarySheet.getRange(4, 2).setValue(currentWords + newWords);
    summarySheet.getRange(6, 2).setValue(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
    
    // 計算本月次數
    const thisMonth = new Date().getMonth();
    const monthCell = summarySheet.getRange(3, 2);
    const lastUpdateMonth = summarySheet.getRange(6, 2).getValue();
    if (lastUpdateMonth && new Date(lastUpdateMonth).getMonth() === thisMonth) {
      monthCell.setValue(parseInt(monthCell.getValue() || 0) + 1);
    } else {
      monthCell.setValue(1);
    }
    
  } catch (error) {
    console.error('更新統計摘要時發生錯誤：', error);
  }
}

// 測試更新統計功能（單獨執行用）
function testUpdateSummary() {
  try {
    // 確認 SPREADSHEET_ID 已設定
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE' || !SPREADSHEET_ID) {
      console.error('❌ 請先設定 SPREADSHEET_ID');
      return;
    }
    
    // 開啟試算表
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ 開啟試算表成功');
    
    // 測試資料
    const testData = {
      fullTranscript: '這是測試文字內容'
    };
    
    // 執行更新
    updateSummarySheet(spreadsheet, testData);
    console.log('✅ 統計更新完成');
    
  } catch (error) {
    console.error('❌ 測試失敗：', error);
  }
}

// GET 請求處理（用於測試）
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ready',
      message: 'PWA Meeting Recorder - Google Sheets 整合服務',
      version: '2.0',
      supportedSources: ['PWA Meeting Recorder', 'AssemblyAI', 'Generic']
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 診斷函數
function diagnose() {
  console.log('開始診斷...\n');
  
  if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE' || !SPREADSHEET_ID) {
    console.error('❌ 錯誤：SPREADSHEET_ID 尚未設定！');
    return;
  }
  
  console.log('✅ SPREADSHEET_ID 已設定：' + SPREADSHEET_ID);
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ 成功開啟試算表：' + spreadsheet.getName());
    console.log('試算表 URL：' + spreadsheet.getUrl());
    
    // 檢查各工作表
    ['會議記錄', '語音轉文字記錄', '統計摘要'].forEach(sheetName => {
      try {
        const sheet = spreadsheet.getSheetByName(sheetName);
        console.log(`✅ 找到工作表：${sheetName} (${sheet.getLastRow()} 列資料)`);
      } catch (err) {
        console.log(`⚠️ 工作表 "${sheetName}" 不存在，將在需要時自動建立`);
      }
    });
    
    console.log('\n診斷完成！系統正常。');
  } catch (error) {
    console.error('❌ 無法開啟試算表！');
    console.error('錯誤訊息：' + error.toString());
  }
}

// 初始化所有工作表
function initializeSheets() {
  try {
    console.log('開始初始化工作表...');
    
    // 確認 SPREADSHEET_ID
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE' || !SPREADSHEET_ID) {
      console.error('❌ 請先設定 SPREADSHEET_ID');
      return;
    }
    
    // 開啟試算表
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ 開啟試算表：' + spreadsheet.getName());
    
    // 建立會議記錄工作表
    let meetingSheet = getOrCreateSheet(spreadsheet, SHEET_NAME);
    if (meetingSheet.getLastRow() === 0) {
      setupPWAHeaders(meetingSheet);
      console.log('✅ 已設定會議記錄標題列');
    }
    
    // 建立統計摘要工作表
    let summarySheet = getOrCreateSheet(spreadsheet, SUMMARY_SHEET_NAME);
    if (summarySheet.getLastRow() === 0) {
      const headers = [
        ['統計項目', '數值'],
        ['總處理次數', '0'],
        ['本月處理次數', '0'],
        ['總字數', '0'],
        ['平均錄音長度', '0'],
        ['最後更新時間', '']
      ];
      summarySheet.getRange(1, 1, headers.length, 2).setValues(headers);
      summarySheet.getRange(1, 1, 1, 2).setBackground('#34a853').setFontColor('#ffffff').setFontWeight('bold');
      console.log('✅ 已設定統計摘要標題列');
    }
    
    console.log('✅ 所有工作表初始化完成！');
    console.log('試算表 URL：' + spreadsheet.getUrl());
    
  } catch (error) {
    console.error('❌ 初始化失敗：', error);
  }
}

// 測試 PWA 資料
function testPWAData() {
  const testData = {
    source: 'PWA Meeting Recorder',
    fileName: '測試會議錄音.webm',
    processingTime: new Date().toLocaleString('zh-TW'),
    duration: '00:45:30',
    meetingSummary: '討論了Q4產品開發計劃，確定了三個主要功能的優先順序。',
    keyPoints: [
      '使用者介面需要重新設計',
      'API 效能需要優化',
      '新功能開發時程確認'
    ],
    decisions: [
      '優先開發手機版本',
      '延後桌面版更新至明年Q1'
    ],
    actionItems: [
      'John - 完成UI設計稿 (12/31前)',
      'Mary - 優化API效能 (1/15前)',
      'Tom - 準備測試計劃 (1/10前)'
    ],
    followUp: [
      '下週確認設計稿',
      '月底前完成第一階段開發'
    ],
    fullTranscript: '這是完整的會議內容...'
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  console.log(result.getContent());
}