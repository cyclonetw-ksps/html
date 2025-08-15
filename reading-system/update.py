#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
課文索引自動更新系統
自動掃描 DATA 資料夾並生成 data-index.json
"""

import os
import json
import sys
from datetime import datetime
from pathlib import Path
import re

class TextbookIndexer:
    def __init__(self):
        self.data_dir = 'DATA'
        self.index_file = 'data-index.json'
        self.stats = {
            'new_dirs': [],
            'new_files': [],
            'deleted_dirs': [],
            'deleted_files': [],
            'total_dirs': 0,
            'total_files': 0
        }
        
    def natural_sort_key(self, text):
        """自然排序（處理中文數字）"""
        chinese_nums = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
            '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20
        }
        
        # 提取「第X課」中的數字
        match = re.search(r'第(.+?)課', text)
        if match:
            num_str = match.group(1)
            if num_str in chinese_nums:
                return chinese_nums[num_str]
            try:
                return int(num_str)
            except:
                pass
        
        # 如果不是標準格式，用原始字串排序
        return text
    
    def load_old_index(self):
        """載入舊的索引以比較變化"""
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def scan_directory(self):
        """掃描 DATA 資料夾"""
        if not os.path.exists(self.data_dir):
            print(f"❌ 錯誤：找不到 {self.data_dir} 資料夾！")
            print(f"📁 請確保資料夾結構如下：")
            print(f"   {os.getcwd()}/")
            print(f"   ├── index.html")
            print(f"   ├── update.py (這個檔案)")
            print(f"   └── DATA/")
            print(f"       ├── 輸林國語一上/")
            print(f"       │   ├── 第一課.txt")
            print(f"       │   └── ...")
            print(f"       └── ...")
            sys.exit(1)
        
        index = {}
        
        # 取得所有子資料夾
        subdirs = [d for d in os.listdir(self.data_dir) 
                  if os.path.isdir(os.path.join(self.data_dir, d))]
        
        # 自然排序資料夾
        subdirs.sort(key=self.natural_sort_key)
        
        for grade_dir in subdirs:
            grade_path = os.path.join(self.data_dir, grade_dir)
            
            # 掃描 txt 檔案
            txt_files = []
            for file in os.listdir(grade_path):
                if file.endswith('.txt'):
                    # 檢查檔案是否為空
                    file_path = os.path.join(grade_path, file)
                    if os.path.getsize(file_path) > 0:
                        txt_files.append(file)
                    else:
                        print(f"⚠️  警告：{grade_dir}/{file} 是空檔案，已跳過")
            
            if txt_files:
                # 自然排序檔案
                txt_files.sort(key=self.natural_sort_key)
                index[grade_dir] = txt_files
                self.stats['total_files'] += len(txt_files)
        
        self.stats['total_dirs'] = len(index)
        return index
    
    def compare_changes(self, old_index, new_index):
        """比較新舊索引找出變化"""
        # 找出新增的目錄
        for dir_name in new_index:
            if dir_name not in old_index:
                self.stats['new_dirs'].append(dir_name)
            else:
                # 找出新增的檔案
                old_files = set(old_index[dir_name])
                new_files = set(new_index[dir_name])
                added = new_files - old_files
                for file in added:
                    self.stats['new_files'].append(f"{dir_name}/{file}")
                
                # 找出刪除的檔案
                deleted = old_files - new_files
                for file in deleted:
                    self.stats['deleted_files'].append(f"{dir_name}/{file}")
        
        # 找出刪除的目錄
        for dir_name in old_index:
            if dir_name not in new_index:
                self.stats['deleted_dirs'].append(dir_name)
    
    def save_index(self, index):
        """儲存索引檔案"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        
        # 同時生成一個易讀的文字報告
        report_file = 'data-report.txt'
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*60 + "\n")
            f.write(f"課文索引報告\n")
            f.write(f"生成時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*60 + "\n\n")
            
            for dir_name, files in index.items():
                f.write(f"【{dir_name}】共 {len(files)} 課\n")
                for file in files:
                    f.write(f"  - {file.replace('.txt', '')}\n")
                f.write("\n")
    
    def print_summary(self):
        """顯示更新摘要"""
        print("\n" + "="*60)
        print("📚 課文索引更新完成！")
        print("="*60)
        
        # 基本統計
        print(f"\n📊 統計資訊：")
        print(f"   年級版本: {self.stats['total_dirs']} 個")
        print(f"   課文總數: {self.stats['total_files']} 個")
        
        # 顯示變更
        if self.stats['new_dirs']:
            print(f"\n✨ 新增目錄:")
            for dir_name in self.stats['new_dirs']:
                print(f"   + {dir_name}")
        
        if self.stats['new_files']:
            print(f"\n📝 新增檔案:")
            for file in self.stats['new_files'][:5]:  # 只顯示前5個
                print(f"   + {file}")
            if len(self.stats['new_files']) > 5:
                print(f"   ... 還有 {len(self.stats['new_files'])-5} 個新檔案")
        
        if self.stats['deleted_dirs']:
            print(f"\n🗑️  刪除目錄:")
            for dir_name in self.stats['deleted_dirs']:
                print(f"   - {dir_name}")
        
        if self.stats['deleted_files']:
            print(f"\n📄 刪除檔案:")
            for file in self.stats['deleted_files'][:5]:
                print(f"   - {file}")
            if len(self.stats['deleted_files']) > 5:
                print(f"   ... 還有 {len(self.stats['deleted_files'])-5} 個檔案被刪除")
        
        print(f"\n💾 已生成檔案：")
        print(f"   - data-index.json (網頁使用)")
        print(f"   - data-report.txt (檢視用)")
        
        print(f"\n⏰ 更新時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n✅ 下一步：git add . && git commit -m \"更新課文\" && git push")
        print("="*60)
    
    def run(self):
        """執行主程序"""
        print("🔍 開始掃描 DATA 資料夾...")
        
        # 載入舊索引
        old_index = self.load_old_index()
        
        # 掃描目錄
        new_index = self.scan_directory()
        
        # 比較變化
        self.compare_changes(old_index, new_index)
        
        # 儲存新索引
        self.save_index(new_index)
        
        # 顯示摘要
        self.print_summary()
        
        return 0

def main():
    """主函數"""
    try:
        indexer = TextbookIndexer()
        return indexer.run()
    except KeyboardInterrupt:
        print("\n\n⚠️  使用者中斷執行")
        return 1
    except Exception as e:
        print(f"\n❌ 發生錯誤：{e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())