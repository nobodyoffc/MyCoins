package com.mycoins_temp

import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "mycoins_temp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Pass null instead of savedInstanceState. When Android kills the
    // backgrounded process after a long sleep and later recreates the Activity,
    // the saved state holds a stale native fragment hierarchy that
    // react-native-screens cannot restore, which crashes on resume. Passing
    // null discards that state so React Navigation rebuilds the screens from JS.
    // See: https://github.com/software-mansion/react-native-screens#android
    super.onCreate(null)
    // Prevent screenshots and screen recording for security
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    )
  }
}
