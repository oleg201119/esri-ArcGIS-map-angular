import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MapComponent } from './map/map.component';
import { InfoComponent } from './info/info.component';

const routes: Routes = [
    { path: '', redirectTo: '/map', pathMatch: 'full' },
    { path: 'map', component: MapComponent },
    { path: 'info', component: InfoComponent }
];

@NgModule({
    imports: [ RouterModule.forRoot(routes) ],
    exports: [ RouterModule ]
})
export class AppRoutingModule {}