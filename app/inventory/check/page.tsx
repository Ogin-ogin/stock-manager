const handleSaveInventory = async () => {
  if (!checkerName.trim()) {
    alert("点検者名を入力してください")
    return
  }

  try {
    setSaving(true)
    
    // データの構造を明確にし、デバッグログを追加
    const inventoryData = inventoryItems.map(item => ({
      productId: item.id, // 正しいproductIdが設定されているか確認
      stockCount: item.updatedStock // 数値として送信
    }))

    console.log("Sending inventory data:", inventoryData) // デバッグログ追加
    console.log("Checker name:", checkerName) // デバッグログ追加

    const response = await fetch("/api/inventory/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkerName: checkerName.trim(),
        inventoryData
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log("Save result:", result) // デバッグログ追加
    
    // Show success message with auto-order info
    let message = "在庫点検が正常に保存されました。"
    if (result.autoOrdersCreated > 0) {
      message += `\n${result.autoOrdersCreated}件の自動発注を作成しました。`
    }
    
    alert(message)
    
    // Redirect back to inventory page
    router.push("/inventory")
    
  } catch (e: any) {
    console.error("Failed to save inventory:", e)
    setError(e.message)
    alert("在庫点検の保存に失敗しました: " + e.message)
  } finally {
    setSaving(false)
  }
}