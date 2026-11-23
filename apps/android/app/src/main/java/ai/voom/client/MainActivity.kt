package ai.voom.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Navy = Color(0xFF07111F)
private val Panel = Color(0xFF0D1B2A)
private val Raised = Color(0xFF13263A)
private val Blue = Color(0xFF4D9EFF)
private val Cyan = Color(0xFF65D8E8)
private val TextMain = Color(0xFFE7EEF7)
private val Muted = Color(0xFF91A4BA)
private val Amber = Color(0xFFE9B45F)
private val Border = Color(0xFF20354A)

private enum class Screen { OVERVIEW, MARKET, ANALYSIS, BRIDGE }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { VoomApp() }
    }
}

@Composable
private fun VoomApp() {
    var language by remember { mutableStateOf("TH") }
    var screen by remember { mutableStateOf(Screen.OVERVIEW) }
    var supabaseStatus by remember { mutableStateOf("Not verified") }
    var supabaseChecking by remember { mutableStateOf(false) }
    val thai = language == "TH"
    val title = when (screen) {
        Screen.OVERVIEW -> if (thai) "ภาพรวมระบบ" else "System overview"
        Screen.MARKET -> if (thai) "ตลาด" else "Markets"
        Screen.ANALYSIS -> if (thai) "ผลวิเคราะห์" else "Analysis"
        Screen.BRIDGE -> if (thai) "การเชื่อมต่อ" else "Connections"
    }
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy, contentColor = TextMain) {
            Column(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Raised, shape = RoundedCornerShape(11.dp), modifier = Modifier.size(40.dp).border(1.dp, Blue.copy(alpha = .5f), RoundedCornerShape(11.dp))) {
                                androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
                                    Text("V", color = Color(0xFFA9D7FF), fontSize = 21.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(Modifier.width(11.dp))
                            Column {
                                Text("VOOM AI", fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = 1.4.sp)
                                Text("POWERED BY NOVA", color = Muted, fontSize = 9.sp, letterSpacing = 1.1.sp)
                            }
                        }
                        TextButton(onClick = { language = if (thai) "EN" else "TH" }) { Text(if (thai) "EN" else "TH", color = Blue) }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Text(if (thai) "WORKSPACE" else "WORKSPACE", color = Blue, fontSize = 9.sp, letterSpacing = 1.6.sp)
                            Text(title, color = TextMain, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        }
                        StatusPill(if (thai) "ปิดการเทรดจริง" else "LIVE TRADING OFF", Amber)
                    }
                    when (screen) {
                        Screen.OVERVIEW -> Overview(thai)
                        Screen.MARKET -> EmptyPanel(
                            if (thai) "ตลาดที่ติดตาม" else "Watchlist",
                            if (thai) "ยังไม่มี Market Feed" else "No market feed connected",
                            if (thai) "ราคาจะแสดงเมื่อเชื่อมต่อแหล่งข้อมูลที่ตรวจสอบได้" else "Prices appear after a verifiable market source is connected"
                        )
                        Screen.ANALYSIS -> EmptyPanel(
                            if (thai) "ยังไม่มีผลวิเคราะห์" else "No analysis yet",
                            if (thai) "เชื่อมต่อ NOVA Core เพื่อเริ่มวิเคราะห์" else "Connect NOVA Core to request analysis",
                            if (thai) "ข้อมูล OHLCV จากผู้ใช้ยังไม่ถือเป็นข้อมูลที่ Broker ยืนยัน" else "User-provided OHLCV is not broker-verified"
                        )
                        Screen.BRIDGE -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatusCard(if (thai) "NOVA CORE" else "NOVA CORE", if (thai) "ระบบวิเคราะห์หลัก" else "Analysis engine", thai)
                            StatusCard("MT5 BRIDGE", if (thai) "การเชื่อมต่อ MetaTrader 5" else "MetaTrader 5 connection", thai)
                            Text("Supabase Auth health check", color = Muted, fontSize = 11.sp)
                            Text(supabaseStatus, color = if (supabaseStatus.startsWith("Connected")) Cyan else Amber, fontSize = 12.sp)
                            TextButton(
                                enabled = !supabaseChecking,
                                onClick = {
                                    supabaseChecking = true
                                    SupabaseConnection.check { result ->
                                        supabaseStatus = result
                                        supabaseChecking = false
                                    }
                                }
                            ) {
                                Text(
                                    if (supabaseChecking) {
                                        if (thai) "กำลังตรวจสอบ…" else "Checking…"
                                    } else {
                                        if (thai) "ตรวจสอบ Supabase" else "Test Supabase"
                                    },
                                    color = Blue
                                )
                            }
                            Text(if (thai) "สถานะ NOVA และ MT5 จะแสดงเมื่อได้รับข้อมูลยืนยันจาก API/Heartbeat จริงเท่านั้น" else "NOVA and MT5 status require verified API/heartbeat responses.", color = Muted, fontSize = 11.sp)
                        }
                    }
                    Text(if (thai) "READ-ONLY · PAPER SIMULATION เท่านั้น" else "READ-ONLY · PAPER SIMULATION ONLY", color = Cyan, fontSize = 9.sp, letterSpacing = .8.sp)
                }
                Row(
                    modifier = Modifier.fillMaxWidth().background(Panel).border(width = 1.dp, color = Border).padding(horizontal = 6.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    NavItem(if (thai) "ภาพรวม" else "Overview", "◫", screen == Screen.OVERVIEW) { screen = Screen.OVERVIEW }
                    NavItem(if (thai) "ตลาด" else "Markets", "⌁", screen == Screen.MARKET) { screen = Screen.MARKET }
                    NavItem(if (thai) "วิเคราะห์" else "Analysis", "⌗", screen == Screen.ANALYSIS) { screen = Screen.ANALYSIS }
                    NavItem(if (thai) "เชื่อมต่อ" else "Bridge", "⇄", screen == Screen.BRIDGE) { screen = Screen.BRIDGE }
                }
            }
        }
    }
}

@Composable
private fun Overview(thai: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Surface(color = Panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(18.dp))) {
            Row(modifier = Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.foundation.layout.Box(modifier = Modifier.width(3.dp).height(74.dp).background(Blue, RoundedCornerShape(4.dp)))
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(if (thai) "NOVA SYSTEM HUB" else "NOVA SYSTEM HUB", color = Blue, fontSize = 9.sp, letterSpacing = 1.3.sp)
                    Text(if (thai) "พื้นที่ควบคุมและวิเคราะห์ตลาด" else "Market intelligence workspace", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text(if (thai) "ตรวจสอบความพร้อมก่อนเริ่มวิเคราะห์" else "Check system readiness before analysis", color = Muted, fontSize = 11.sp)
                }
            }
        }
        StatusCard("NOVA CORE", if (thai) "ระบบวิเคราะห์หลัก" else "Analysis engine", thai)
        StatusCard("MT5 BRIDGE", if (thai) "การเชื่อมต่อ MetaTrader 5" else "MetaTrader 5 connection", thai)
        StatusCard(if (thai) "MARKET DATA" else "MARKET DATA", if (thai) "แหล่งข้อมูลตลาด" else "Market data source", thai)
        EmptyPanel(
            if (thai) "ตลาดที่ติดตาม · XAUUSDm" else "Watchlist · XAUUSDm",
            if (thai) "ยังไม่มีข้อมูลตลาด" else "Awaiting market data",
            if (thai) "ไม่มีการแสดงราคาแทนข้อมูลจริง" else "No placeholder prices are displayed"
        )
        Surface(color = Raised, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(if (thai) "ขอบเขตความปลอดภัย" else "Safety boundary", color = Cyan, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(if (thai) "หน้านี้ใช้ดูข้อมูลและวิเคราะห์เท่านั้น ไม่มีการส่งคำสั่งซื้อขายหรือแก้ไขบัญชีโบรกเกอร์" else "Monitoring and analysis only. No trade orders or broker account changes.", color = Muted, fontSize = 10.sp, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun StatusCard(name: String, description: String, thai: Boolean) {
    Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(name, color = Muted, fontSize = 9.sp, letterSpacing = 1.2.sp)
                StatusPill(if (thai) "ยังไม่ยืนยัน" else "Not verified", Muted)
            }
            Text(if (thai) "ยังไม่มีข้อมูลการเชื่อมต่อ" else "No connection data", color = TextMain, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(description, color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun EmptyPanel(title: String, message: String, hint: String) {
    Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = TextMain, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(message, color = TextMain, fontSize = 12.sp)
            Text(hint, color = Muted, fontSize = 10.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun StatusPill(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.border(1.dp, color.copy(alpha = .45f), CircleShape).padding(horizontal = 8.dp, vertical = 5.dp)) {
        androidx.compose.foundation.layout.Box(Modifier.size(5.dp).background(color, CircleShape))
        Text(label, color = color, fontSize = 9.sp)
    }
}

@Composable
private fun NavItem(label: String, icon: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(icon, color = if (selected) Blue else Muted, fontSize = 17.sp)
            Text(label, color = if (selected) TextMain else Muted, fontSize = 9.sp)
        }
    }
}
