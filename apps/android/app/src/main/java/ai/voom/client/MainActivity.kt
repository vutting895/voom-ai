package ai.voom.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Navy = Color(0xFF071426)
private val Panel = Color(0xFF0D2037)
private val ElectricBlue = Color(0xFF167CE5)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { VoomApp() }
    }
}

@androidx.compose.runtime.Composable
private fun VoomApp() {
    var language by remember { mutableStateOf("TH") }
    val thai = language == "TH"
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Navy, contentColor = Color(0xFFE8F1FF)) {
            Column(
                modifier = Modifier.fillMaxSize().padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("VOOM AI", fontSize = 23.sp, color = Color.White)
                        Text("POWERED BY NOVA", fontSize = 10.sp, color = Color(0xFF7FA9D6))
                    }
                    TextButton(onClick = { language = if (thai) "EN" else "TH" }) {
                        Text(if (thai) "EN" else "TH", color = Color(0xFF72C4FF))
                    }
                }
                Spacer(Modifier.height(30.dp))
                Text("NOVA SYSTEM HUB", color = Color(0xFF55A8FF), fontSize = 12.sp)
                Text("VOOM AI", fontSize = 42.sp, color = Color.White)
                Text(
                    if (thai) "ระบบวิเคราะห์ตลาดจาก NOVA Core" else "Market analysis powered by NOVA Core",
                    color = Color(0xFF9FB5D0)
                )
                Surface(color = Panel, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(if (thai) "READ-ONLY · ปิด Live Trading" else "READ-ONLY · LIVE TRADING OFF", color = Color(0xFF72C4FF))
                        Text(if (thai) "Client foundation พร้อมสำหรับเชื่อมต่อระบบยืนยันตัวตนและ Analysis API" else "Client foundation ready for Auth and Analysis API integration.")
                        Text(if (thai) "ยังไม่มีการเชื่อมต่อบัญชีโบรกเกอร์หรือส่งคำสั่งซื้อขาย" else "No broker account connection or order execution is available.")
                        Button(onClick = { }, enabled = false, modifier = Modifier.fillMaxWidth()) {
                            Text(if (thai) "รอการเชื่อมต่อ API" else "API integration pending")
                        }
                    }
                }
                Text(
                    if (thai) "Paper Simulation เท่านั้น · ไม่มีคำสั่งซื้อขายจริง" else "Paper Simulation only · No live orders",
                    color = ElectricBlue,
                    fontSize = 12.sp
                )
            }
        }
    }
}
