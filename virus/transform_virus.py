import os
import csv

raw_path = './csv/raw/'
raw_csvs = os.listdir(raw_path)
print(raw_csvs)

clean_path = './csv/clean/'

for raw_csv in raw_csvs:
  with open(raw_path + raw_csv, newline='') as csv_file:
    csv_reader = csv.reader(csv_file, delimiter=',')

    for row in csv_reader:
      # print(row)
      
      index = 0
      for value in row:
        if not value:
          row[index] = '0'
        else:
          row[index] = value.replace(',', '')
        index += 1
      
      # print(row)
      # print('\n')
    
    clean_csv = clean_path + raw_csv.replace(' ', '')
    print(clean_csv)