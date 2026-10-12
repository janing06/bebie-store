import { useEffect, useState } from 'react'
import { Route, Switch } from 'wouter'
import { CartProvider } from './CartProvider'
import { CheckoutScreen } from './screens/CheckoutScreen'
import { CustomerScreen } from './screens/CustomerScreen'
import { ImportScreen } from './screens/ImportScreen'
import { MoreScreen } from './screens/MoreScreen'
import { ProductFormScreen } from './screens/ProductFormScreen'
import { ProductsScreen } from './screens/ProductsScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { SaleSavedScreen } from './screens/SaleSavedScreen'
import { SellScreen } from './screens/SellScreen'
import { UtangScreen } from './screens/UtangScreen'
import { Splash } from './Splash'
import { Screen } from './ui'

const SPLASH_MS = 1200

export function AppRoutes() {
  return (
    <CartProvider>
      <Switch>
        <Route path="/" component={SellScreen} />
        <Route path="/checkout" component={CheckoutScreen} />
        <Route path="/sold/:id" component={SaleSavedScreen} />
        <Route path="/products" component={ProductsScreen} />
        <Route path="/products/new" component={ProductFormScreen} />
        <Route path="/products/:id" component={ProductFormScreen} />
        <Route path="/utang" component={UtangScreen} />
        <Route path="/utang/:id" component={CustomerScreen} />
        <Route path="/reports" component={ReportsScreen} />
        <Route path="/more" component={MoreScreen} />
        <Route path="/import" component={ImportScreen} />
        <Route>
          <Screen title="Not found" back>
            <p className="text-slate-600">This page does not exist.</p>
          </Screen>
        </Route>
      </Switch>
    </CartProvider>
  )
}

export function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  return showSplash ? <Splash /> : <AppRoutes />
}
