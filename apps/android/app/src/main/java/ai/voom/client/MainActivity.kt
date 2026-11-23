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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
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

private enum class Screen { OVERVIEW, DASHBOARD, PORTFOLIO, MARKET, ANALYSIS, BRIDGE }

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
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var authSession by remember { mutableStateOf<AuthSession?>(null) }
    val accessToken = authSession?.accessToken.orEmpty()
    var authBusy by remember { mutableStateOf(false) }
    val authOperations = remember { AuthOperationGate() }
    var chatInput by remember { mutableStateOf("") }
    var chatMessages by remember { mutableStateOf(listOf<NovaChatMessage>()) }
    var chatBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var supabaseStatus by remember { mutableStateOf("Not verified") }
    var supabaseChecking by remember { mutableStateOf(false) }
    var coreSnapshot by remember { mutableStateOf<NovaCoreSnapshot?>(null) }
    var coreChecking by remember { mutableStateOf(false) }
    var coreRequestId by remember { mutableStateOf(0) }
    var coreError by remember { mutableStateOf("") }

    val thai = language == "TH"
    val title = when (screen) {
        Screen.OVERVIEW -> if (thai) "ภาพรวมระบบ" else "System overview"
        Screen.DASHBOARD -> if (thai) "แดชบอร์ด" else "Dashboard"
        Screen.PORTFOLIO -> if (thai) "พอร์ตการลงทุน" else "Portfolio"
        Screen.MARKET -> if (thai) "ตลาด" else "Markets"
        Screen.ANALYSIS -> if (thai) "NOVA AI Chat" else "NOVA AI Chat"
        Screen.BRIDGE -> if (thai) "การเชื่อมต่อ" else "Connections"
    }

    fun signIn() {
        if (email.isBlank() || password.isBlank()) {
            error = if (thai) "กรุณากรอกอีเมลและรหัสผ่าน" else "Enter your email and password"
            return
        }
        val operationId = authOperations.begin()
        authBusy = true
        error = ""
        NovaApi.signIn(email, password) { session, failure ->
            // Ignore stale authentication callbacks after a newer auth operation.
            if (authOperations.isCurrent(operationId)) {
                authBusy = false
                if (session != null) {
                    authSession = session
                    password = ""
                    error = ""
                    screen = Screen.ANALYSIS
                } else {
                    password = ""
                    error = failure ?: if (thai) "เข้าสู่ระบบไม่สำเร็จ" else "Sign-in failed"
                }
            }
        }
    }

    fun signOut() {
        // Invalidate pending sign-in/refresh/chat callbacks even when no token exists.
        val operationId = authOperations.begin()
        val token = accessToken
        authSession = null
        password = ""
        chatInput = ""
        chatMessages = emptyList()
        chatBusy = false
        coreSnapshot = null
        coreChecking = false
        coreRequestId += 1
        coreError = ""
        authBusy = false
        error = ""
        screen = Screen.OVERVIEW
        if (token.isBlank()) return

        // Invalidate local UI state immediately; the remote revoke is best-effort.
        authBusy = true
        NovaApi.signOut(token) { failure ->
            // A late sign-out response must not overwrite a newer sign-in state.
            if (authOperations.isCurrent(operationId)) {
                authBusy = false
                error = if (failure == null) "" else if (thai) {
                    "ล้าง Session ในแอปแล้ว แต่ยืนยันการออกจากระบบกับ Supabase ไม่ได้"
                } else {
                    "Local session cleared; Supabase sign-out could not be confirmed"
                }
            }
        }
    }

    fun refreshCoreStatus() {
        val token = accessToken
        if (token.isBlank()) {
            coreError = if (thai) "กรุณาเข้าสู่ระบบก่อนตรวจสอบ NOVA Core" else "Sign in before checking NOVA Core"
            return
        }
        val requestId = coreRequestId + 1
        coreRequestId = requestId
        coreChecking = true
        coreError = ""
        NovaApi.fetchCoreSnapshot(token) { snapshot, failure ->
            // Ignore responses invalidated by sign-out or a newer refresh request.
            if (coreRequestId == requestId && authSession != null) {
                coreSnapshot = snapshot
                coreError = failure.orEmpty()
                coreChecking = false
            }
        }
    }

    fun sendMessage() {
        val prompt = chatInput.trim()
        val currentSession = authSession
        if (currentSession == null) {
            error = if (thai) "กรุณาเข้าสู่ระบบก่อน" else "Sign in before using NOVA AI"
            return
        }
        if (prompt.isBlank()) return
        if (prompt.length > 1200) {
            error = if (thai) "ข้อความยาวเกิน 1,200 ตัวอักษร" else "Message exceeds 1,200 characters"
            return
        }
        val requestMessages = (chatMessages + NovaChatMessage("user", prompt)).takeLast(8)
        if (requestMessages.sumOf { it.content.length } > 8000) {
            error = if (thai) "ประวัติการสนทนามีขนาดใหญ่เกินไป" else "Conversation is too large"
            return
        }

        val operationId = authOperations.begin()
        chatBusy = true
        error = ""
        fun submitWith(session: AuthSession) {
            if (!authOperations.isCurrent(operationId) || authSession != session) return
            NovaApi.sendChat(session.accessToken, requestMessages) { reply, failure ->
                if (authOperations.isCurrent(operationId) && authSession == session) {
                    chatBusy = false
                    if (reply != null) {
                        chatMessages = (requestMessages + NovaChatMessage("assistant", reply.message)).takeLast(8)
                        chatInput = ""
                        error = ""
                    } else {
                        error = failure ?: if (thai) "NOVA AI ไม่พร้อมใช้งาน" else "NOVA AI is unavailable"
                    }
                }
            }
        }

        if (currentSession.shouldRefresh(System.currentTimeMillis() / 1000L)) {
            NovaApi.refreshSession(currentSession) { refreshed, failure ->
                if (authOperations.isCurrent(operationId) && authSession == currentSession) {
                    if (refreshed != null) {
                        // Replace the whole session because Supabase can rotate refresh_token.
                        authSession = refreshed
                        submitWith(refreshed)
                    } else {
                        authSession = null
                        chatBusy = false
                        chatMessages = emptyList()
                        error = failure ?: if (thai) "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" else "Session expired. Sign in again."
                    }
                }
            }
        } else {
            submitWith(currentSession)
        }
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (accessToken.isNotBlank()) {
                                TextButton(onClick = { signOut() }) {
                                    Text(if (thai) "ออกจากระบบ" else "Sign out", color = Muted, fontSize = 11.sp)
                                }
                            }
                            TextButton(onClick = { language = if (thai) "EN" else "TH" }) { Text(if (thai) "EN" else "TH", color = Blue) }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Text("WORKSPACE", color = Blue, fontSize = 9.sp, letterSpacing = 1.6.sp)
                            Text(title, color = TextMain, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        }
                        StatusPill(if (thai) "ปิดการเทรดจริง" else "LIVE TRADING OFF", Amber)
                    }
                    when (screen) {
                        Screen.OVERVIEW -> Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                            Surface(color = Panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(18.dp))) {
                                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("NOVA SYSTEM HUB", color = Blue, fontSize = 9.sp, letterSpacing = 1.3.sp)
                                    Text(if (thai) "พื้นที่ควบคุมและวิเคราะห์ตลาด" else "Market intelligence workspace", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                                    Text(if (thai) "ตรวจสอบความพร้อมก่อนเริ่มวิเคราะห์" else "Check system readiness before analysis", color = Muted, fontSize = 11.sp)
                                }
                            }
                            if (accessToken.isBlank()) {
                                AuthPanel(email, { email = it }, password, { password = it }, authBusy, error, thai, { signIn() })
                            } else {
                                Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
                                    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                        Text("SUPABASE AUTH", color = Muted, fontSize = 9.sp, letterSpacing = 1.2.sp)
                                        Text(if (thai) "ได้รับ User Access Token แล้ว" else "User access token received", color = TextMain, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                        Text(if (thai) "เก็บ Session ในหน่วยความจำเท่านั้น" else "Session is held in memory only", color = Muted, fontSize = 10.sp)
                                        StatusPill(if (thai) "Authenticated" else "Authenticated", Cyan)
                                    }
                                }
                            }
                            StatusCard("NOVA CORE", if (thai) "ระบบวิเคราะห์หลัก" else "Analysis engine", thai)
                            StatusCard("MT5 BRIDGE", if (thai) "การเชื่อมต่อ MetaTrader 5" else "MetaTrader 5 connection", thai)
                            StatusCard("MARKET DATA", if (thai) "แหล่งข้อมูลตลาด" else "Market data source", thai)
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
                        Screen.DASHBOARD -> DashboardPanel(thai)
                        Screen.PORTFOLIO -> PortfolioPanel(thai)
                        Screen.MARKET -> EmptyPanel(
                            if (thai) "ตลาดที่ติดตาม" else "Watchlist",
                            if (thai) "ยังไม่มี Market Feed" else "No market feed connected",
                            if (thai) "ราคาจะแสดงเมื่อเชื่อมต่อแหล่งข้อมูลที่ตรวจสอบได้" else "Prices appear after a verifiable market source is connected"
                        )
                        Screen.ANALYSIS -> if (accessToken.isBlank()) {
                            AuthPanel(email, { email = it }, password, { password = it }, authBusy, error, thai, { signIn() })
                        } else {
                            ChatPanel(chatMessages, chatInput, { chatInput = it }, chatBusy, error, thai, { sendMessage() })
                        }
                        Screen.BRIDGE -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatusCard("NOVA CORE", if (thai) "System Integration Hub" else "System Integration Hub", thai)
                            Text(
                                coreSnapshot?.let { if (thai) "ยืนยัน API แล้ว · ${it.integrations.size} integrations" else "API authenticated · ${it.integrations.size} integrations" }
                                    ?: if (thai) "ยังไม่ยืนยันการเชื่อมต่อ NOVA Core" else "NOVA Core is not verified",
                                color = if (coreSnapshot != null) Cyan else Amber,
                                fontSize = 12.sp
                            )
                            Button(
                                enabled = !coreChecking && accessToken.isNotBlank(),
                                onClick = { refreshCoreStatus() },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(if (coreChecking) {
                                    if (thai) "กำลังตรวจสอบ..." else "Checking..."
                                } else {
                                    if (thai) "ตรวจสอบ NOVA Core" else "Check NOVA Core"
                                })
                            }
                            if (coreError.isNotBlank()) Text(coreError, color = Amber, fontSize = 11.sp)
                            coreSnapshot?.let { snapshot ->
                                Text(if (thai) "Integrations" else "Integrations", color = Muted, fontSize = 10.sp)
                                snapshot.integrations.forEach { Text(it, color = TextMain, fontSize = 11.sp) }
                                Text(if (thai) "Connections ของบัญชีนี้" else "Connections owned by this account", color = Muted, fontSize = 10.sp)
                                if (snapshot.connections.isEmpty()) {
                                    Text(if (thai) "ยังไม่มี Connection" else "No connections registered", color = Muted, fontSize = 11.sp)
                                } else {
                                    snapshot.connections.forEach { Text(it, color = TextMain, fontSize = 11.sp) }
                                }
                                Text(if (thai) "ข้อมูลบัญชี/ตลาดยังไม่ถือว่ายืนยันจนกว่าจะมี data_verified จาก Proxy" else "Account/market data remains unverified until the Proxy confirms it.", color = Amber, fontSize = 10.sp)
                            }
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
                            Text(if (thai) "คำขอใช้ GET แบบ authenticated read-only เท่านั้น ไม่มีการสร้าง Connection หรือส่งคำสั่งซื้อขาย" else "Only authenticated read-only GET requests are made. No connection is created and no trade is submitted.", color = Muted, fontSize = 11.sp)
                        }
                    }
                    Text(if (thai) "READ-ONLY · PAPER SIMULATION เท่านั้น" else "READ-ONLY · PAPER SIMULATION ONLY", color = Cyan, fontSize = 9.sp, letterSpacing = .8.sp)
                }
                Row(
                    modifier = Modifier.fillMaxWidth().background(Panel).border(width = 1.dp, color = Border).padding(horizontal = 6.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    NavItem(if (thai) "Home" else "Home", "⌂", screen == Screen.OVERVIEW) { screen = Screen.OVERVIEW; error = "" }
                    NavItem(if (thai) "Dashboard" else "Dashboard", "▦", screen == Screen.DASHBOARD) { screen = Screen.DASHBOARD; error = "" }
                    NavItem(if (thai) "Portfolio" else "Portfolio", "◫", screen == Screen.PORTFOLIO) { screen = Screen.PORTFOLIO; error = "" }
                    NavItem(if (thai) "ตลาด" else "Markets", "⌁", screen == Screen.MARKET) { screen = Screen.MARKET; error = "" }
                    NavItem("AI", "⌗", screen == Screen.ANALYSIS) { screen = Screen.ANALYSIS; error = "" }
                    NavItem(if (thai) "Bridge" else "Bridge", "⇄", screen == Screen.BRIDGE) { screen = Screen.BRIDGE; error = "" }
                }
            }
        }
    }
}

@Composable
private fun AuthPanel(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    busy: Boolean,
    error: String,
    thai: Boolean,
    onSignIn: () -> Unit
) {
    Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (thai) "เข้าสู่ระบบ NOVA" else "Sign in to NOVA", color = TextMain, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(value = email, onValueChange = onEmailChange, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text(if (thai) "อีเมล" else "Email") })
            OutlinedTextField(value = password, onValueChange = onPasswordChange, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), label = { Text(if (thai) "รหัสผ่าน" else "Password") })
            if (error.isNotBlank()) Text(error, color = Amber, fontSize = 11.sp)
            Button(onClick = onSignIn, enabled = !busy && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) (if (thai) "กำลังเข้าสู่ระบบ…" else "Signing in…") else (if (thai) "เข้าสู่ระบบ" else "Sign in"))
            }
            Text(if (thai) "Session เก็บในหน่วยความจำเท่านั้น ปิดแอปแล้วต้องเข้าสู่ระบบใหม่" else "The access token stays in memory only. Sign in again after restarting the app.", color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun ChatPanel(
    messages: List<NovaChatMessage>,
    input: String,
    onInputChange: (String) -> Unit,
    busy: Boolean,
    error: String,
    thai: Boolean,
    onSend: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(if (thai) "ผู้ช่วยวิจัย NOVA" else "NOVA Research Assistant", color = Cyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                if (messages.isEmpty()) {
                    Text(if (thai) "ถามเกี่ยวกับตลาด แนวคิดกลยุทธ์ คุณภาพข้อมูล หรือความเสี่ยง" else "Ask about markets, strategy hypotheses, data quality, or risk.", color = Muted, fontSize = 11.sp, lineHeight = 17.sp)
                }
                messages.forEach { message ->
                    Surface(
                        color = if (message.role == "user") Raised else Navy,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(if (message.role == "user") (if (thai) "คุณ" else "You") else "NOVA AI", color = Blue, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            Text(message.content, color = TextMain, fontSize = 11.sp, lineHeight = 17.sp)
                        }
                    }
                }
            }
        }
        OutlinedTextField(
            value = input,
            onValueChange = onInputChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5,
            label = { Text(if (thai) "ข้อความ" else "Message") },
            placeholder = { Text(if (thai) "พิมพ์คำถาม..." else "Type your question...") }
        )
        if (error.isNotBlank()) Text(error, color = Amber, fontSize = 11.sp)
        Button(onClick = onSend, enabled = !busy && input.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
            Text(if (busy) (if (thai) "กำลังตอบ..." else "Thinking...") else (if (thai) "ส่งข้อความ" else "Send message"))
        }
        Text(if (thai) "ข้อมูลเพื่อการวิจัยเท่านั้น ไม่มีคำสั่งซื้อขาย และ Live Trading ปิดอยู่" else "Research only. No order capability. Live Trading remains OFF.", color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun DashboardPanel(thai: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = Panel, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(16.dp))) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("ACCOUNT OVERVIEW", color = Blue, fontSize = 9.sp, letterSpacing = 1.3.sp)
                Text(if (thai) "ภาพรวมบัญชีเทรด" else "Trading account overview", color = TextMain, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Text(if (thai) "รอเชื่อมต่อ NOVA Core / MT5 Bridge" else "Awaiting NOVA Core / MT5 Bridge connection", color = Amber, fontSize = 10.sp)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            MetricTile(if (thai) "Balance" else "Balance", "—", if (thai) "ยอดเงินคงเหลือ" else "Account balance", Modifier.weight(1f))
            MetricTile("Equity", "—", if (thai) "มูลค่าทุนสุทธิ" else "Net equity", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            MetricTile("Floating P/L", "—", if (thai) "กำไร/ขาดทุนลอยตัว" else "Unrealized P/L", Modifier.weight(1f))
            MetricTile(if (thai) "Positions" else "Positions", "—", if (thai) "สถานะที่เปิดอยู่" else "Open positions", Modifier.weight(1f))
        }
        EmptyPanel(
            if (thai) "สถานะการเชื่อมต่อ" else "Connection status",
            if (thai) "ยังไม่มีข้อมูลบัญชีจาก API ที่ยืนยันตัวตนและตรวจสอบ ownership แล้ว" else "No account data from an authenticated, owner-scoped API has been verified.",
            if (thai) "ตัวเลขจะแสดงเมื่อ API ยืนยันผู้ใช้และบัญชี MT5 ที่เป็นเจ้าของเท่านั้น" else "Metrics will appear only after user and MT5 account ownership are verified."
        )
        Text(if (thai) "ข้อมูลบัญชีไม่ถูกจำลอง และไม่มีการส่งคำสั่งซื้อขายจากหน้านี้" else "Account values are not simulated. This page cannot submit trades.", color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun PortfolioPanel(thai: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = Panel, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(16.dp))) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("PORTFOLIO", color = Blue, fontSize = 9.sp, letterSpacing = 1.3.sp)
                Text(if (thai) "สินทรัพย์และสถานะการถือครอง" else "Assets and open positions", color = TextMain, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Text(if (thai) "ข้อมูลจริงจะแสดงเมื่อเชื่อมต่อ API สำเร็จ" else "Live values appear after a verified API connection", color = Muted, fontSize = 10.sp)
            }
        }
        Surface(color = Panel, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Border, RoundedCornerShape(14.dp))) {
            Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (thai) "สินทรัพย์" else "ASSET", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(if (thai) "ฝั่ง / ขนาด" else "SIDE / SIZE", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text("P/L", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
                androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().height(1.dp).background(Border))
                Text(if (thai) "ยังไม่มีข้อมูล Portfolio" else "No portfolio data available", color = TextMain, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                Text(if (thai) "ไม่มีการสร้างรายการสินทรัพย์หรือสถานะจำลอง" else "No synthetic assets or positions are generated.", color = Muted, fontSize = 10.sp)
            }
        }
        MetricTile(if (thai) "มูลค่าพอร์ตรวม" else "Total portfolio value", "—", if (thai) "รอข้อมูลจากบัญชีที่ยืนยันแล้ว" else "Awaiting verified account data", Modifier.fillMaxWidth())
        MetricTile(if (thai) "กำไร/ขาดทุนรวม" else "Total P/L", "—", if (thai) "รอข้อมูลจาก API" else "Awaiting API data", Modifier.fillMaxWidth())
    }
}

@Composable
private fun MetricTile(label: String, value: String, hint: String, modifier: Modifier = Modifier) {
    Surface(color = Panel, shape = RoundedCornerShape(13.dp), modifier = modifier.border(1.dp, Border, RoundedCornerShape(13.dp))) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, color = Muted, fontSize = 9.sp, letterSpacing = .5.sp)
            Text(value, color = TextMain, fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
            Text(hint, color = Muted, fontSize = 9.sp, lineHeight = 13.sp)
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
