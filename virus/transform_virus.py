import os
import pandas as pd

raw_path = './csv/raw/'
raw_csvs = os.listdir(raw_path)
print(raw_csvs)

clean_path = './csv/clean/'

for raw_csv in raw_csvs:
  if 'country' in raw_csv:
    index_col = 'country'
  else:
    index_col = 'state'

  df = pd.read_csv(raw_path + raw_csv, delimiter=',', index_col=index_col)

  for column in df:
    if df[column].dtypes == 'object':
      df[column] = df[column].str.replace(",","").astype(float)

  df = df.fillna(0)

  for column in df:
    if df[column].dtypes == 'float64':
      df[column] = df[column].astype('int32')

  df.to_csv(clean_path + raw_csv.replace(' ', ''))

  print(df.dtypes)
  print(df)