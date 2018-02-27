import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'map-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.css']
})
export class InfoComponent implements OnInit {

  // Private properties for binding
  private sub: any;
  private long: string;
  private lat: string;

  constructor(private route: ActivatedRoute) { }

  ngOnInit() {
    // Subscribe to route params
    this.sub = this.route.queryParams.subscribe(params => {
      this.long = params['long'];
      this.lat = params['lat'];
    });
  }

}
