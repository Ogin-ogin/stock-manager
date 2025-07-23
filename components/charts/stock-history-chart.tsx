"use client"

import React from "react"

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface StockHistoryChartProps {
  data: { [key: string]: any; date: string }[]
  productNames: string[]
  title?: string
  description?: string
  graphPastDays: number // 過去データの表示期間
  graphForecastDays: number // 予測データの表示期間
}

export function StockHistoryChart({ 
  data, 
  productNames, 
  title, 
  description, 
  graphPastDays, 
  graphForecastDays 
}: StockHistoryChartProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // Hydration mismatchを防ぐため、マウントされるまでレンダリングしない
  }

  // グラフの線の色を動的に生成
  const colors = [
    "#8884d8", // purple
    "#82ca9d", // green
    "#ffc658", // yellow
    "#ff7300", // orange
    "#0088FE", // blue
    "#00C49F", // teal
    "#FFBB28", // gold
    "#FF8042", // coral
    "#AF19FF", // violet
    "#DE3163", // crimson
  ]

  const textColor = theme === "dark" ? "#A1A1AA" : "#71717A" // muted-foreground

  // 過去データと予測データを分けるためのインデックスを計算
  const today = new Date().toISOString().split("T")[0]
  let lastPastDataIndex = -1
  for (let i = 0; i < data.length; i++) {
    if (new Date(data[i].date).toISOString().split("T")[0] <= today) {
      lastPastDataIndex = i
    } else {
      break
    }
  }

  // データを処理して過去データと予測データを分ける
  const processedData = data.map((item, index) => {
    const newItem: any = { date: item.date }
    
    productNames.forEach(name => {
      if (index <= lastPastDataIndex) {
        // 過去データ：実線用
        newItem[name] = item[name]
        newItem[`${name}_forecast`] = null
      } else {
        // 予測データ：破線用
        newItem[name] = null
        newItem[`${name}_forecast`] = item[name]
      }
    })
    
    return newItem
  })

  // 境界点で接続するために、最後の過去データポイントを予測データにも含める
  if (lastPastDataIndex >= 0 && lastPastDataIndex < data.length - 1) {
    const boundaryItem = processedData[lastPastDataIndex]
    productNames.forEach(name => {
      if (boundaryItem[name] != null) {
        boundaryItem[`${name}_forecast`] = boundaryItem[name]
      }
    })
  }

  // カスタムツールチップコンポーネント
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const displayedItems: { name: string; value: number; color: string; isForecast: boolean }[] = []
      const seenProducts = new Set<string>()

      // 現在の日付が過去データの最終日より後かどうかで予測データかを判定
      const lastHistoricalDate = lastPastDataIndex !== -1 ? new Date(data[lastPastDataIndex].date) : null
      const currentDate = new Date(label)
      const isForecast = lastHistoricalDate && currentDate > lastHistoricalDate

      payload.forEach((item: any) => {
        if (item.value != null) {
          const isForecastLine = item.dataKey.includes('_forecast')
          const productName = isForecastLine ? item.dataKey.replace('_forecast', '') : item.dataKey

          // 同じ商品名が既に処理されていない場合のみ追加
          if (!seenProducts.has(productName)) {
            displayedItems.push({
              name: productName,
              value: item.value,
              color: item.color,
              isForecast: isForecast || isForecastLine,
            })
            seenProducts.add(productName)
          }
        }
      })

      return (
        <div
          className="rounded-lg border p-2 shadow-sm"
          style={{
            backgroundColor: theme === "dark" ? "#18181B" : "#FFFFFF",
            borderColor: theme === "dark" ? "#3F3F46" : "#E4E4E7",
          }}
        >
          <p className="text-sm font-bold" style={{ color: textColor }}>{`日付: ${label}`}</p>
          {displayedItems.map((item, index) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {`${item.name}${item.isForecast ? " (予測)" : ""}: ${item.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || "在庫推移グラフ"}</CardTitle>
        <CardDescription>
          {description || `過去${graphPastDays}日間の在庫数の変動と将来${graphForecastDays}日間の予測を表示します`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[450px] md:h-[600px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 20, // 凡例用に下部マージンをさらに増加
              }}
            >
              <XAxis 
                dataKey="date" 
                stroke={textColor} 
                tickFormatter={(value) => value.substring(5)}
                fontSize={16}
              />
              <YAxis 
                stroke={textColor}
                fontSize={16}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{
                  paddingTop: '80px',
                  fontSize: '16px'
                }}
                iconType="line"
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
              />
              {productNames.map((name, index) => (
                <React.Fragment key={name}>
                  {/* 過去データ用のLine（実線） */}
                  <Line
                    type="monotone"
                    dataKey={name}
                    stroke={colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {/* 予測データ用のLine（破線） */}
                  <Line
                    type="monotone"
                    dataKey={`${name}_forecast`}
                    stroke={colors[index % colors.length]}
                    strokeDasharray="5 5" // 破線
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                    dot={false}
                    legendType="none" // 凡例に表示しない
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </React.Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}