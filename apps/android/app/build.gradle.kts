plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "ai.voom.client"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.voom.client"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "NOVA_ANALYSIS_API_BASE_URL", "\"https://REPLACE_WITH_NOVA_SYSTEM_HUB\"")
        buildConfigField("String", "SUPABASE_URL", "\"REPLACE_WITH_SUPABASE_URL\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"REPLACE_WITH_PUBLIC_ANON_KEY\"")
    }

    buildFeatures { compose = true; buildConfig = true }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
